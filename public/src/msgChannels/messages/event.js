/**
 * @fileoverview Defines the EventMessage class, specializing BaseMessage for structured
 * application event broadcasting.
 */

import { BaseMessage } from './base.js';

/**
 * @typedef {import('./messageAgent.js').MessageAgent} MessageAgent
 */


/**
 * @class
 * @extends BaseMessage
 * @property {string} [msgType] - Message Type
 * @property {string} [eventName] - Event Name
 */
export class EventMessage extends BaseMessage {

    /**
     * The standardized message type for application events.
     * @type {string}
     */
    static msgType = 'app_event';

    /**
     * The name of the application event being broadcast.
     * @type {string}
     */
    eventName;

    /**
     * Creates a specialized event message.
     *
     * @param {MessageAgent} agent - The MessageAgent instance of the sender.
     * @param {string} name - The name of the event (e.g., 'file_saved').
     * @param {object|null} [data=null] - Optional data associated with the event.
     * @param {object|null} [metadata=null] - Optional metadata object.
     * @param {string|null} [toAgent=null] - Optional target AgentID for direct messaging.
     */
    constructor(agent, name, data = null, metadata = null, toAgent = null) {
        if (typeof name !== 'string' || name.length === 0) {
            throw new Error('EventMessage requires a non-empty string name.');
        }

        // The payload contains the event name and associated data
        const payload = {
            name: name,
            data: data
        };

        super(agent, EventMessage.msgType, payload, metadata, toAgent); // <-- CORRECTED super call

        // Enforce specific property for direct access
        this.eventName = name;
    }
}