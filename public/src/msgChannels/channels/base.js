/**
 * @fileoverview Defines the BaseChannel class, an object-oriented abstraction
 * over the native BroadcastChannel API. It enforces a structured, traceable
 * message class hierarchy and provides extensible primitives for subclasses.
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

/**
 * @typedef {import('../messages/base.js').BaseMessage} BaseMessage
 * @typedef {import('../messages/messageAgent.js').MessageAgent} MessageAgent
 *
 * @callback MessageCallback
 * @param {BaseMessage} message - The structured message object received.
 * @returns {void}
 */


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
     * @type {Map<string, Array<MessageCallback>>}
     */
    _listeners = new Map();


    /**
     * Initializes the BaseChannel, creating the native BroadcastChannel instance.
     * Registers the private handshake handler and error handler.
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

        // Register native event handlers
        this._channel.onmessage = this._messageRouter.bind(this);
        this._channel.onmessageerror = this._messageErrorHandler.bind(this);

        // Register the internal handshake handler for extensibility
        this.on(HelloMessage.msgType, this._handleHandshake.bind(this));

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
    // Core Messaging and Extensibility Primitives
    // =========================================================================

    /**
     * Extracts the message type string safely from a string or a message class/object.
     * @private
     * @param {string|{msgType: string}} type - The input type definition (string or class with static msgType).
     * @returns {string} The resolved message type string.
     */
    _getTypeString(type) {
        if (typeof type === 'string' && type.length > 0) {
            return type;
        }
        // Handle class objects with a static msgType property
        if (typeof type === 'function' && 'msgType' in type && typeof type.msgType === 'string' && type.msgType.length > 0) {
            return type.msgType;
        }
        // Handle object instances with a msgType property
        if (typeof type === 'object' && type !== null && 'msgType' in type && typeof type.msgType === 'string' && type.msgType.length > 0) {
            return type.msgType;
        }
        throw new Error('Invalid type specified. Must be a non-empty string or an object/class with a valid static msgType property.');
    }

    /**
     * The single router for all incoming messages from the native BroadcastChannel.
     * NOTE: This method is a pure dispatcher/filter. Logic for handshake replies is externalized.
     * @private
     * @param {MessageEvent} event - The native message event.
     */
    _messageRouter(event) {
        const message = event.data;

        // 1. Robust Validation (prevents crashes from malformed data)
        if (typeof message !== 'object' || message === null || typeof message.type !== 'string' || !message.agentID) {
            console.warn(`BaseChannel received malformed or non-protocol data, ignoring:`, message);
            return;
        }

        const type = message.type;

        // 2. Direct Message Filtering
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
     * Handles native BroadcastChannel messageerror events (serialization failure).
     * Reports the failure using the system's ErrorMessage primitive.
     * @private
     * @param {MessageEvent} event - The native messageerror event.
     */
    _messageErrorHandler(event) {
        // Use our structured ErrorMessage to report the native error, ensuring traceability
        this.error(
            `BroadcastChannel message serialization failed. Could not receive data.`,
            { nativeError: event.error, failedData: event.data },
            null // Broadcast the error
        );
    }

    /**
     * @private
     * Handles incoming handshake messages and automatically replies to 'hello'.
     * This decouples the handshake side effect from the core router.
     * @param {BaseMessage} message - The incoming handshake message.
     */
    _handleHandshake(message) {
        if (message.type === HelloMessage.msgType) {
            // Auto-reply to a Hello message with a Greeting (Direct Message)
            this.greeting(message.agentID);
            return;
        }
    }

    /**
     * Sends a structured message across the channel. This is the foundational send utility.
     * @param {BaseMessage} message - The message object to post. Must be an instance of a specialized class.
     * @param {Transferable[]} [transferables=[]] - Array of objects to transfer ownership of.
     */
    sendMsg(message, transferables = []) {
        // CRITICAL FIX: Enforce message structure at runtime
        if (!(message instanceof BaseMessage)) {
            throw new TypeError('Message sent to channel must be an instance of BaseMessage or one of its specialized subclasses.');
        }

        this._channel.postMessage(message, transferables);
    }

    /**
     * Registers a listener for a specific message type.
     * Accepts type as a string or a Message class/object (e.g., LogMessage).
     * @param {string|{msgType: string}} type - The message type or message class/object to listen for.
     * @param {MessageCallback} callback - The function to execute when the message is received.
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
     * @param {string|{msgType: string}} type - The message type or message class/object.
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
        const message = new EventMessage(this.agent, name, data, null, toAgent);
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
     * @param {MessageCallback} callback - Handler receives the full message object.
     */
    onLog(callback) {
        this.on(LogMessage.msgType, callback);
    }

    /**
     * Registers a listener for system error messages.
     * @param {MessageCallback} callback - Handler receives the full message object.
     */
    onError(callback) {
        this.on(ErrorMessage.msgType, callback);
    }

    /**
     * Registers a listener for application events.
     * @param {MessageCallback} callback - Handler receives the full message object.
     */
    onEvent(callback) {
        this.on(EventMessage.msgType, callback);
    }

    /**
     * Registers a listener for system status updates.
     * @param {MessageCallback} callback - Handler receives the full message object.
     */
    onStatus(callback) {
        this.on(StatusMessage.msgType, callback);
    }

    /**
     * Registers a listener for agents joining the channel.
     * NOTE: The automatic reply (greeting) is handled internally.
     * @param {MessageCallback} callback - Handler receives the HelloMessage object.
     */
    onHello(callback) {
        this.on(HelloMessage.msgType, callback);
    }

    /**
     * Registers a listener for agent's direct greeting replies.
     * @param {MessageCallback} callback - Handler receives the GreetingMessage object.
     */
    onGreeting(callback) {
        this.on(GreetingMessage.msgType, callback);
    }

    /**
     * Registers a listener for agents announcing their departure.
     * @param {MessageCallback} callback - Handler receives the GoodbyeMessage object.
     */
    onGoodbye(callback) {
        this.on(GoodbyeMessage.msgType, callback);
    }
}