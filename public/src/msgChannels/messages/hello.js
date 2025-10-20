/**
 * @fileoverview Defines the HelloMessage class, specializing HandshakeMessage for
 * publicly announcing an agent's presence when joining the channel.
 */

import { HandshakeMessage } from './handshake.js';
import {MessageAgent} from './messageAgent.js';


export class HelloMessage extends HandshakeMessage {

    /**
     * The standardized message type for a channel hello announcement.
     * @type {string}
     */
    static msgType = 'channel_hello';

    /**
     * Creates a specialized hello message.
     * This message is sent as a public broadcast once the agent connects to the channel.
     *
     * @param {MessageAgent} agent - The MessageAgent instance of the sender (MANDATORY).
     */
    constructor(agent) {

        super(agent, HelloMessage.msgType, null, null);
    }
}