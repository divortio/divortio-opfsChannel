/**
 * @fileoverview Defines the ErrorMessage class, specializing BaseMessage for structured
 * error reporting. It enforces the serialization of critical error tracing data and includes the log prefix.
 */

import { BaseMessage } from './base.js';

/**
 * @typedef {import('./messageAgent.js').MessageAgent} MessageAgent
 */


export class ErrorMessage extends BaseMessage {

    /**
     * The standardized message type for errors.
     * @type {string}
     */
    static msgType = 'system_error';

    /**
     * The class name of the error (e.g., 'TypeError', 'RemoteError').
     * @type {string}
     */
    errorName;

    /**
     * The primary description of the error.
     * @type {string}
     */
    errorMessage;

    /**
     * The stack trace string, providing file and line number context.
     * @type {string | null}
     */
    errorStack;


    /**
     * Creates a specialized error message, applying the standard logging prefix to the message string.
     *
     * @param {MessageAgent} agent - The MessageAgent instance of the sender.
     * @param {Error|string} error - The JavaScript Error object or a descriptive string.
     * @param {object} [data=null] - Optional additional data/context to send with the error.
     * @param {string|null} [toAgent=null] - Optional target AgentID for direct messaging.
     */
    constructor(agent, error, data = null, toAgent = null) {
        let name;
        let message;
        let stack;
        const level = 'ERROR';

        if (error instanceof Error) {
            name = error.name || 'Error';
            message = error.message;
            stack = error.stack || null;
        } else {
            name = 'SystemError';
            message = String(error);
            stack = null;
        }

        // 1. Generate the standardized prefix string
        const prefix = ErrorMessage._getLogPrefix(agent, level);

        // 2. The payload contains all structured error data
        const payload = {
            name: name,
            message: prefix + message, // Apply prefix to the final message string
            stack: stack,
            data: data,
        };


        // Signature: constructor(agent, type, payload, metadata = null, toAgent = null)
        super(agent, ErrorMessage.msgType, payload, null, toAgent);

        // Enforce specific properties for direct access
        this.errorName = name;
        this.errorMessage = message; // Store the original, un-prefixed message content
        this.errorStack = stack;
    }

    /**
     * Generates a standardized logging prefix string based on the agent and level.
     * Format: [MSG_ID] [ISO_TIMESTAMP] [AGENT_ID] [LEVEL]
     * @private
     * @param {MessageAgent} agent - The MessageAgent instance.
     * @param {string} level - The log level ('ERROR').
     * @returns {string} The formatted prefix string.
     */
    static _getLogPrefix(agent, level) {
        // We generate a dummy BaseMessage *internally* to access the unique msgID/timestamp for the prefix.
        // The BaseMessage constructor is called with mandatory arguments and the payload set to null.
        const tempMessage = new BaseMessage(agent, ErrorMessage.msgType, null);

        const paddedLevel = level.toUpperCase().padStart(5, ' ');
        const isoTime = new Date(tempMessage.timestamp).toISOString();

        // Example: [0QZ7qGgA] [2025-10-18T13:41:43.000Z] [WORKER:0QZ7qGgA] [ERROR]
        return `[${tempMessage.msgID}] [${isoTime}] [${agent.agentID.toUpperCase()}] [${paddedLevel}] `;
    }
}