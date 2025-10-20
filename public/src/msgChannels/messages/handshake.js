/**
 * @fileoverview Defines the HandshakeMessage class, which serves as the base for
 * all agent discovery and channel lifecycle messages (Hello, Greeting, Goodbye).
 * It ensures required agent discovery payload data is included and sets the base message type.
 */

import { BaseMessage } from './base.js';

/**
 * @typedef {import('./messageAgent.js').MessageAgent} MessageAgent
 * @typedef {import('./base.js').MessageMetadata} MessageMetadata
 */

export class HandshakeMessage extends BaseMessage {

    /**
     * The standardized message type for all handshake primitives.
     * NOTE: This is a base type, the specific subclass (e.g., HelloMessage) sets the final value.
     * @type {string}
     */
    static msgType = 'channel_handshake_base';

    /**
     * The scope of the agent sending the handshake (e.g., 'main' or 'worker').
     * @type {string}
     */
    agentScope;

    /**
     * Creates a base handshake message.
     *
     * @param {MessageAgent} agent - The MessageAgent instance of the sender (MANDATORY).
     * @param {string} type - The specific handshake type (e.g., 'channel_hello').
     * @param {MessageMetadata} [metadata=null] - Optional metadata object.
     * @param {string|null} toAgent - The ID of the target agent that sent the original 'hello'.
     */
    constructor(agent, type, metadata = null, toAgent = null) {
        // The payload contains the essential discovery data
        const payload = {
            agentID: agent.agentID, // Redundant in structure but explicit in payload for clarity
            scope: agent.agentScope // Directly pull scope from the agent object
        };

        super(agent, type, payload, metadata, toAgent);

        // Enforce specific properties for direct access
        this.agentScope = agent.agentScope;
    }
}