/**
 * @fileoverview Defines the StatusMessage class, specializing BaseMessage for structured
 * system status key/value updates (e.g., 'cpu_load', 'progress_bar_value').
 */

import { BaseMessage } from './base.js';


/**
 * @typedef {string} StatusKey - The specific system metric being updated (e.g., 'cpu_load', 'memory_usage').
 * @typedef {any} StatusValue - The new value of the status metric.
 * @typedef {import('./messageAgent.js').MessageAgent} MessageAgent
 */

export class StatusMessage extends BaseMessage {

    /**
     * The standardized message type for status updates.
     * @type {string}
     */
    static msgType = 'system_status';

    /**
     * The specific system metric being updated.
     * @type {StatusKey}
     */
    statusKey;

    /**
     * The new value of the status metric.
     * @type {StatusValue}
     */
    statusValue;

    /**
     * Creates a specialized status message.
     *
     * @param {MessageAgent} agent - The MessageAgent instance of the sender.
     * @param {StatusKey} key - The status key (e.g., 'cpu_load').
     * @param {StatusValue} value - The new status value.
     * @param {TargetAgentID} [toAgent=null] - Optional target AgentID for direct messaging.
     */
    constructor(agent, key, value, toAgent = null) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new Error('StatusMessage requires a non-empty string key.');
        }

        // The payload contains the key and value for processing by listeners
        const payload = {
            key: key,
            value: value
        };

        // Signature: constructor(agent, type, payload, metadata = null, toAgent = null)
        super(agent, StatusMessage.msgType, payload, null, toAgent); // <-- CORRECTED super call with null metadata

        // Enforce specific properties for direct access
        this.statusKey = key;
        this.statusValue = value;
    }
}