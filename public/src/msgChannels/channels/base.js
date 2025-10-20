/**
 * @fileoverview Defines the BaseChannel class, an object-oriented abstraction
 * It consumes the complete message class hierarchy for type safety.
 */

import { BaseMessage } from '../messages/base.js';
import { MessageAgent } from '../messages/messageAgent.js';
import { LogMessage } from '../messages/log.js';
import { ErrorMessage } from '../messages/error.js';
import { StatusMessage } from '../messages/status.js';
import { EventMessage } from '../messages/event.js';
import { HelloMessage } from '../messages/hello.js';
import { GreetingMessage } from '../messages/greetings.js';
import { GoodbyeMessage } from '../messages/goodbye.js';



export class BaseChannel {

    /**
     * Internal reference to the native BroadcastChannel instance.
     * @private
     * @type {BroadcastChannel}
     */
    _channel;

    /**
     * The unique name used to connect contexts (Main Thread, Worker, etc.).
     * @type {string}
     */
    channelName;

    /**
     * The agent object containing environment context (ID, scope).
     * @private
     * @type {MessageAgent}
     */
    agent;

    /**
     * Map of message types to their registered callbacks.
     * @private
     * @type {Map<string, Array<(message: BaseMessage) => void>>}
     */
    _listeners = new Map();



    /**
     * Initializes the BaseChannel, creating the native BroadcastChannel instance.
     * @param {string} channelName - The unique name for this communication channel.
     * @param {string|null} [agentName=null] - Optional name for this context (e.g., 'UI').
     */
    constructor(channelName, agentName = null) {
        if (typeof channelName !== 'string' || channelName.length === 0) {
            throw new Error('BaseChannel requires a non-empty channel name.');
        }

        this.channelName = channelName;

        this.agent = new MessageAgent(agentName);
        this._channel = new BroadcastChannel(channelName);
        this._channel.onmessage = this._messageRouter.bind(this);

        this.hello();
    }

    /**
     * Gets the full unique identifier for the current context.
     * @returns {string}
     */
    get agentID() {
        return this.agent.agentID;
    }

    // =========================================================================
    // Core Messaging and Lifecycle
    // =========================================================================

    /**
     * Extracts the message type string safely from a string or a message class/object.
     * @private
     * @param {string|{msgType: string}} type - The input type definition.
     * @returns {string} The resolved message type string.
     */
    _getTypeString(type) {
        if (typeof type === 'string' && type.length > 0) {
            return type;
        }
        if (typeof type === 'object' && 'msgType' in type && typeof type.msgType === 'string' && type.msgType.length > 0) {
            return type.msgType;
        }
        throw new Error('Invalid type specified. Must be a string or an object/class with a valid static msgType property.');
    }

    /**
     * The single router for all incoming messages from the native BroadcastChannel.
     * @private
     * @param {object} msg - The native message event.
     * @returns {BaseMessage}
     */
    _getMsg(msg){

        if (typeof msg == 'object' && 'type' in msg &&  msg.type !== 'string') {
            return msg;
        }

    }

    /**
     * The single router for all incoming messages from the native BroadcastChannel.
     * @private
     * @param {MessageEvent} event - The native message event.
     */
    _messageRouter(event) {

        const message = this._getMsg(event.data);
        const type = message.type;

        // CRITICAL: Handshake Logic - Intercept HELLO/GOODBYE
        if (type === HelloMessage.msgType) {
            this.greeting(message.agentID);
        }

        // 1. Direct Message Filtering
        if (message.toAgent && message.toAgent !== this.agentID) {
            return;
        }

        // 3. Handle Standard Dispatch (General Listeners)
        const listeners = this._listeners.get(type) || [];
        if (listeners.length > 0) {
            for (const callback of listeners) {
                try {
                    callback(message);
                } catch (e) {
                    console.error(`BaseChannel listener failed for type '${type}' in context '${this.agentID}':`, e);
                }
            }
        }
    }

    /**
     * Sends a structured message across the channel. This is the foundational send utility.
     * RENAMED from send to sendMsg.
     * @param {BaseMessage} message - The message object to post. Must be an instance of a specialized class.
     * @param {Transferable[]} [transferables=[]] - Array of objects to transfer ownership of.
     */
    sendMsg(message, transferables = []) {
        this._channel.postMessage(message, transferables);
    }

    /**
     * Registers a listener for a specific message type.
     * Accepts type as a string or a Message class/object.
     * @param {string} type - The message type or message class/object to listen for.
     * @param {(message: BaseMessage) => void} callback - The function to execute when the message is received.
     */
    on(type, callback) {
        const typeString = this._getTypeString(type);
        const listeners = this._listeners.get(typeString) || [];
        listeners.push(callback);
        this._listeners.set(typeString, listeners);
    }

    /**
     * Removes a specific listener function for a message type.
     * Accepts type as a string or a Message class/object.
     * @param {string} type - The message type or message class/object.
     * @param {Function} callback - The function previously registered with `on()`.
     */
    off(type, callback) {
        const typeString = this._getTypeString(type);
        const listeners = this._listeners.get(typeString);
        if (listeners) {
            this._listeners.set(typeString, listeners.filter(cb => cb !== callback));
        }
    }

    /**
     * Closes the native BroadcastChannel instance and cleans up resources.
     * Sends a 'goodbye' message just before closing.
     */
    close() {
        this.goodbye(); // Announce departure
        this._channel.close();
        this._listeners.clear();

    }

    // =========================================================================
    // Agent Discovery Primitives
    // =========================================================================

    /**
     * [PRIMITIVE] Announces this agent's presence to the channel using HelloMessage.
     */
    hello() {
        const message = new HelloMessage(this.agent);
        this.sendMsg(message);
    }

    /**
     * [PRIMITIVE] Replies directly to a 'hello' message, confirming presence.
     * @param {string} toAgentID - The ID of the agent that sent the 'hello' message.
     */
    greeting(toAgentID) {
        const message = new GreetingMessage(this.agent, toAgentID);
        this.sendMsg(message);
    }

    /**
     * [PRIMITIVE] Announces this agent's departure from the channel using GoodbyeMessage.
     */
    goodbye() {
        const message = new GoodbyeMessage(this.agent);
        this.sendMsg(message);
    }





    // =========================================================================
    // Symmetrical Convenience Methods (Producer)
    // =========================================================================

    /**
     * Sends a structured log message.
     * Signature: message, data=null, level='info', toAgent=null
     * @param {string} message - The primary log message.
     * @param {any} [data=null] - Optional additional data/context.
     * @param {'info'|'warn'|'debug'} [level='info'] - The log level.
     * @param {string|null} [toAgent=null] - Direct Message target.
     */
    log(message, data = null, level = 'info', toAgent = null) {
        const logMessage = new LogMessage(this.agent, level, message, data, toAgent);
        this.sendMsg(logMessage);
    }

    /**
     * Sends a structured error message. Accepts an Error object or string.
     * @param {Error|string} err - The Error object or primary error message string.
     * @param {object|null} [data=null] - Optional additional data/context.
     * @param {string|null} [toAgent=null] - Direct Message target.
     */
    error(err, data = null, toAgent = null) {
        const errorMessage = new ErrorMessage(this.agent, err, data, toAgent);
        this.sendMsg(errorMessage);
    }

    /**
     * Sends a generic, named application event.
     * @param {string} name - The name of the event (e.g., 'file_saved').
     * @param {object|null} [data=null] - Optional event data.
     * @param {string|null} [toAgent=null] - Direct Message target.
     */
    event(name, data = null, toAgent = null) {
        const message = new EventMessage(this.agent, name, data, null, toAgent); // Added null for metadata
        this.sendMsg(message);
    }

    /**
     * Broadcasts an update to a specific system status key/value.
     * @param {string} key - The status key (e.g., 'cpu_load').
     * @param {any} value - The new status value.
     * @param {string|null} [toAgent=null] - Direct Message target.
     */
    status(key, value, toAgent = null) {
        const message = new StatusMessage(this.agent, key, value, toAgent);
        this.sendMsg(message);
    }


    // =========================================================================
    // Symmetrical Convenience Methods (Listener)
    // =========================================================================

    /**
     * Registers a listener for system log messages.
     * @param {(message: BaseMessage) => void} callback - Handler receives the full message object.
     */
    onLog(callback) {
        const type = LogMessage.msgType;
        this.on(type, callback);
    }

    /**
     * Registers a listener for system error messages.
     * @param {(message: BaseMessage) => void} callback - Handler receives the full message object.
     */
    onError(callback) {
        const type = ErrorMessage.msgType;
        this.on(type, callback);
    }

    /**
     * Registers a listener for application events.
     * @param {(message: BaseMessage) => void} callback - Handler receives the full message object.
     */
    onEvent(callback) {
        const type = EventMessage.msgType;
        this.on(type, callback);
    }

    /**
     * Registers a listener for system status updates.
     * @param {(message: BaseMessage) => void} callback - Handler receives the full message object.
     */
    onStatus(callback) {
        this.on(StatusMessage.msgType, callback);
    }


}