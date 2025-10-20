/**
 * @fileoverview Defines the RequestMessage class, specializing BaseMessage for initiating
 * a promise-based request/response synchronization cycle. It uses the metadata field
 * to specify the actual request type.
 */

import { BaseMessage } from './base.js';


/**
 * @typedef {import('./messageAgent.js').MessageAgent} MessageAgent
 */

export class RequestMessage extends BaseMessage {

    /**
     * The simplified, static message type for all requests.
     * BaseChannel will use this for filtering and add the unique trace ID to the message type.
     * @type {string}
     */
    static msgType = 'request';

    /**
     * The unique identifier of this request message. This is a copy of msgID
     * used specifically to signal that this message is a request trace ID.
     * @type {string}
     */
    requestMsgID;

    /**
     * Creates a specialized request message.
     *
     * @param {MessageAgent} agent - The MessageAgent instance of the sender.
     * @param {string} originalType - The specific request type (e.g., 'get_config').
     * @param {object|null} [payload=null] - Optional data required to fulfill the request.
     * @param {string|null} [toAgent=null] - Optional target AgentID for direct messaging.
     */
    constructor(agent, originalType, payload = null, toAgent = null) {
        if (typeof originalType !== 'string' || originalType.length === 0) {
            throw new Error('RequestMessage requires a non-empty string for originalType.');
        }

        // 1. Create the MessageMetadata object to store the original request type
        const metadata = {
            requestType: originalType
        };

        super(agent, RequestMessage.msgType, payload, metadata, toAgent);
        // Enforce specific property:
        this.requestMsgID = this.msgID; // Enforce redundancy for clarity

    }
}