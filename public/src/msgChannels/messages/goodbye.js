/**
 * @fileoverview Defines the GoodbyeMessage class, specializing HandshakeMessage for
 * announcing an agent's departure from the channel, sent just before calling close().
 */

import { HandshakeMessage } from './handshake.js';


/**
 * @typedef {import('./messageAgent.js').MessageAgent} MessageAgent
 * @typedef {import('./base.js').MessageMetadata} MessageMetadata
 */

export class GoodbyeMessage extends HandshakeMessage {

    /**
     * The standardized message type for a channel goodbye announcement.
     * @type {string}
     */
    static msgType = 'channel_goodbye';

    /**
     * Creates a specialized goodbye message.
     * This message is sent as a public broadcast just before the agent closes its channel connection.
     *
     * @param {MessageAgent} agent - The MessageAgent instance of the sender (MANDATORY).
     */
    constructor(agent) {
        // Signature: constructor(type, agent, toAgent = null, metadata = null)
        super(agent, GoodbyeMessage.msgType, null, null);
    }
}