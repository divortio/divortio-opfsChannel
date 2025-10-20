/**
 * @fileoverview Defines the ResponseMessage class, specializing BaseMessage for fulfilling
 * a promise-based request/response synchronization cycle.
 */

import { BaseMessage } from './base.js';


/**
 * @typedef {import('./messageAgent.js').MessageAgent} MessageAgent
 */

export class ResponseMessage extends BaseMessage {

    /**
     * The simplified, static message type for all responses.
     * @type {string}
     */
    static msgType = 'response';

    /**
     * The MessageID of the original RequestMessage this message is fulfilling.
     * This field is critical for resolving the pending promise on the sender's side.
     * @type {string}
     */
    requestMsgID;

    /**
     * Creates a specialized response message.
     *
     * @param {MessageAgent} agent - The MessageAgent instance of the sender.
     * @param {string} requestMsgID - The msgID of the original request message.
     * @param {object|null} [payload=null] - The data resulting from the request fulfillment.
     * @param {object|null} [requestMetadata=null] - The metadata of the original request message.
     * @param {string|null} [toAgent=null] - The ID of the original requesting agent (used for Direct Messaging).
     */
    constructor(agent, requestMsgID, payload = null, requestMetadata = null, toAgent = null) {
        if (typeof requestMsgID !== 'string' || requestMsgID.length === 0) {
            throw new Error('ResponseMessage requires a requestMsgID to link back to the request.');
        }

        // The final response metadata includes the original request ID and the original request's metadata
        const metadata = {
            requestMsgID: requestMsgID,
            ...requestMetadata // Spread the metadata from the original request for context
        };

        // Signature: constructor(agent, type, payload, metadata = null, toAgent = null)
        super(agent, ResponseMessage.msgType, payload, metadata, toAgent);

        // Enforce specific property
        this.requestMsgID = requestMsgID;
    }
}