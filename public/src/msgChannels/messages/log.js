/**
 * @fileoverview Defines the LogMessage class, specializing BaseMessage for structured logging.
 * It enforces the presence of 'level' and 'logMessage' fields and handles the log prefix rendering.
 */

import { BaseMessage } from './base.js';


/**
 * @typedef {import('./messageAgent.js').MessageAgent} MessageAgent
 */


export class LogMessage extends BaseMessage {

    /**
     * The standardized message type for logging.
     * @type {string}
     */
    static msgType = 'system_log';

    /**
     * The standardized logging level of this message.
     * @type {'info'|'warn'|'debug'}
     */
    level;

    /**
     * The primary log message string *before* prefixing.
     * @type {string}
     */
    logMessage;

    /**
     * Creates a specialized log message, applying the standard logging prefix to the message string.
     *
     * @param {MessageAgent} agent - The MessageAgent instance of the sender.
     * @param  {'info'|'warn'|'debug'} level - The logging severity level ('info', 'warn', or 'debug').
     * @param {string} message - The primary log message string.
     * @param {object|null} [data=null] - Optional additional data/context for the log.
     * @param {string|null} [toAgent=null] - Optional target AgentID for direct messaging.
     */
    constructor(agent, level, message, data = null, toAgent = null) {
        if (!['info', 'warn', 'debug'].includes(level)) {
            throw new Error(`Invalid log level: ${level}. Must be 'info', 'warn', or 'debug'.`);
        }

        // 1. Generate the standardized prefix string
        const prefix = LogMessage._getLogPrefix(agent, level);

        // 2. Combine level and data into the generic payload
        const payload = {
            level: level,
            message: prefix + message, // <-- Apply prefix to the final message string
            data: data,
            timestamp: Date.now() // Redundant as BaseMessage adds timestamp, but kept in payload for clarity
        };

        super(agent, LogMessage.msgType, payload, null, toAgent);

        // Enforce specific properties via accessors
        this.level = level;
        this.logMessage = message; // Store the original message without prefix for debugging
    }

    /**
     * Generates a standardized logging prefix string based on the agent and level.
     * Format: [MSG_ID] [ISO_TIMESTAMP] [AGENT_ID] [LEVEL]
     * @private
     * @param {MessageAgent} agent - The MessageAgent instance.
     * @param {'info'|'warn'|'debug'} level - The log level.
     * @returns {string} The formatted prefix string.
     */
    static _getLogPrefix(agent, level) {
        // We generate a dummy BaseMessage *internally* to access the unique msgID/timestamp for the prefix.
        const tempMessage = new BaseMessage(agent, LogMessage.msgType, null);

        const paddedLevel = level.toUpperCase().padStart(5, ' ');
        const isoTime = new Date(tempMessage.timestamp).toISOString();

        // Example: [0QZ7qGgA] [2025-10-18T13:41:43.000Z] [WORKER:0QZ7qGgA] [INFO ]
        return `[${tempMessage.msgID}] [${isoTime}] [${agent.agentID.toUpperCase()}] [${paddedLevel}] `;
    }
}