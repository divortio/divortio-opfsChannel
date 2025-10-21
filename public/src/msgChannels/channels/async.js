/**
 * @fileoverview Defines the AsyncChannel class, extending BaseChannel to provide
 * a promise-based Request/Response synchronization mechanism over BroadcastChannel.
 * This is crucial for orchestrating tasks and retrieving results from Web Workers.
 */

import { BaseChannel } from './base.js';
import { RequestMessage } from '../messages/request.js';
import { ResponseMessage } from '../messages/response.js';
import { ErrorMessage } from '../messages/error.js';

/**
 * @typedef {import('../messages/base.js').BaseMessage} BaseMessage
 * @typedef {import('../messages/messageAgent.js').MessageAgent} MessageAgent
 *
 * @typedef {object} PendingRequest
 * @property {(payload: any) => void} resolve
 * @property {(reason: any) => void} reject
 * @property {number} timeout
 */

/**
 * Custom error used for request timeouts.
 */
class RequestTimeoutError extends Error {
    constructor(msgID) {
        super(`Request timed out after 10000ms. ID: ${msgID}`);
        this.name = 'RequestTimeoutError';
        this.requestMsgID = msgID;
    }
}


export class AsyncChannel extends BaseChannel {

    /**
     * Map of MessageID to a PendingRequest object containing resolve/reject functions and timeout.
     * @private
     * @type {Map<string, PendingRequest>}
     */
    _pendingRequests = new Map();

    /**
     * Default timeout for a request/response cycle in milliseconds.
     * @type {number}
     */
    static DEFAULT_TIMEOUT = 10000; // 10 seconds

    /**
     * Initializes the AsyncChannel and registers the listener for incoming responses.
     * @param {string} channelName - The unique name for this communication channel.
     * @param {string|null} [agentName=null] - Optional name for this context (e.g., 'UI').
     */
    constructor(channelName, agentName = null) {
        super(channelName, agentName);

        // Register the primary listener for all incoming responses and errors
        this.on(ResponseMessage.msgType, this._handleResponse.bind(this));
        // Also listen for system errors, in case an error message is broadcast in place of a response
        this.on(ErrorMessage.msgType, this._handleResponse.bind(this));
    }


    // =========================================================================
    // Core Logic
    // =========================================================================

    /**
     * Sends a promise-based request and waits for a corresponding ResponseMessage.
     * @param {string} type - The specific request type (e.g., 'get_file_size').
     * @param {object|null} [payload=null] - Data required for the request.
     * @param {string|null} [toAgent=null] - Optional target AgentID for Direct Messaging.
     * @param {number} [timeout=AsyncChannel.DEFAULT_TIMEOUT] - Timeout in milliseconds.
     * @returns {Promise<any>} A promise that resolves with the response payload.
     */
    request(type, payload = null, toAgent = null, timeout = AsyncChannel.DEFAULT_TIMEOUT) {
        const requestMessage = new RequestMessage(this.agent, type, payload, toAgent);
        const requestMsgID = requestMessage.requestMsgID;

        // 1. Send the message
        this.sendMsg(requestMessage);

        // 2. Create and return the tracking Promise
        return new Promise((resolve, reject) => {
            // Setup timeout
            const timeoutId = setTimeout(() => {
                this._pendingRequests.delete(requestMsgID);
                reject(new RequestTimeoutError(requestMsgID));
            }, timeout);

            // Store resolve, reject, and timeout to be retrieved by _handleResponse
            this._pendingRequests.set(requestMsgID, { resolve, reject, timeout: timeoutId });
        });
    }

    /**
     * Processes incoming ResponseMessage or ErrorMessage and fulfills the pending Promise.
     * @private
     * @param {BaseMessage} message - The incoming response or error message.
     */
    _handleResponse(message) {
        const requestMsgID = message.metadata?.requestMsgID;

        if (!requestMsgID) {
            // Ignore messages without a linked request ID
            return;
        }

        const pendingRequest = this._pendingRequests.get(requestMsgID);

        if (!pendingRequest) {
            // Ignore if no matching pending request is found (e.g., late response)
            return;
        }

        // Cleanup: Clear the timeout and remove from map
        clearTimeout(pendingRequest.timeout);
        this._pendingRequests.delete(requestMsgID);

        // Check if the response is an explicit error message
        if (message.type === ErrorMessage.msgType) {
            const error = new Error(`Remote Error: ${message.payload.message}`);
            // Attach structured error data for debugging
            error.remoteStack = message.payload.stack;
            error.remoteData = message.payload.data;
            pendingRequest.reject(error);
            return;
        }

        // Normal response fulfillment
        pendingRequest.resolve(message.payload);
    }

    // =========================================================================
    // Symmetrical Convenience Methods (Responder - for consumers)
    // =========================================================================

    /**
     * Registers a listener for a specific RequestMessage type.
     * @param {string} requestType - The specific request type to listen for (e.g., 'get_config').
     * @param {(payload: object, req: RequestMessage) => Promise<any>} callback - The handler that returns a Promise for the result.
     */
    onRequest(requestType, callback) {
        // The request type is stored in metadata, so we listen for the generic 'request' type
        this.on(RequestMessage.msgType, async (message) => {
            // Only handle messages matching the specific request type filter
            if (message.metadata?.requestType !== requestType) {
                return;
            }

            try {
                // Execute the callback which should return the result payload
                const resultPayload = await callback(message.payload, message);

                // Send success response (Direct Message)
                const response = new ResponseMessage(
                    this.agent,
                    message.msgID, // original request ID
                    resultPayload,
                    message.metadata, // original metadata
                    message.agentID // sender of the request
                );
                this.sendMsg(response);

            } catch (error) {
                // Send error response (Direct Message)
                // We use ErrorMessage instead of ResponseMessage(error) to standardize error reporting
                const errorMsg = new ErrorMessage(
                    this.agent,
                    error,
                    { originalRequestID: message.msgID },
                    message.agentID // sender of the request
                );
                // Ensure the response link is present on the ErrorMessage metadata
                errorMsg.metadata.requestMsgID = message.msgID;
                this.sendMsg(errorMsg);
            }
        });
    }

    /**
     * Closes the channel and cleans up all pending requests.
     */
    close() {
        // Reject and clean up all outstanding promises
        this._pendingRequests.forEach(req => {
            clearTimeout(req.timeout);
            req.reject(new Error(`Channel closed. Request aborted.`));
        });
        this._pendingRequests.clear();

        super.close();
    }
}