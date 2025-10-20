/**
 * @fileoverview Defines the GreetingMessage class, specializing HandshakeMessage for
 * replying directly to a 'hello' message, confirming the sender's active presence.
 */

import { HandshakeMessage } from './handshake.js';

/**
 * @typedef {import('./messageAgent.js').MessageAgent} MessageAgent
 */

export class GreetingMessage extends HandshakeMessage {

    /**
     * The standardized message type for a channel greeting reply.
     * @type {string}
     */
    static msgType = 'channel_greeting';

    /**
     * Creates a specialized greeting message.
     * This message is sent as a Direct Message (DM) in response to a public 'hello' broadcast.
     *
     * @param {MessageAgent} agent - The full ID of the sender (the agent confirming presence).
     * @param {string} toAgent - The ID of the target agent that sent the original 'hello'.
     */
    constructor(agent, toAgent) {
        if (!toAgent) {
            throw new Error('GreetingMessage requires a target AgentID (toAgent) to ensure direct delivery.');
        }

        // Call the parent constructor with the standardized greeting type, agent, and scope.
        super(agent, GreetingMessage.msgType, null, toAgent );
    }
}