/**
 * @fileoverview Defines the BaseMessage class, which serves as the primitive foundation
 * for all structured, traceable communication objects in the foremanWorker library.
 * It enforces the presence of a mandatory MessageAgent instance for trace stability.
 */

import { pushID } from '../../vendor/pushID.js';

/**
 * @typedef {object} MessageMetadata - Object containing message specific context like type of request.
 */


/**
 * @typedef {import('./messageAgent.js').MessageAgent} MessageAgent
 */



/**
 * Returns an AgentID based on a string or MessageAgent object
 * @method
 * @param {string| {agentID: string}} agent - The MessageAgent instance of the sender (MANDATORY).
 * @returns {string} - agentID identifying the instance to the channel
 */
const getAgentID = (agent) => {
    // Case 1: Already a valid, non-empty string ID
    if (typeof agent === 'string' && agent.length > 0) {
        return agent;
    }
    // Case 2: A MessageAgent-like object
    if (typeof agent === 'object' && agent !== null &&
        typeof agent.agentID === 'string' && agent.agentID.length > 0) {
        return agent.agentID;
    }

    // Default: Invalid input
    throw new Error('BaseMessage requires a valid AgentID(string) or MessageAgent instance containing agentID (agent.agentID).');
}

/**
 * Primitive Message Object which is extended by specific Message types
 * @class
 * @property {string} [msgID] - Message ID
 * @property {number} [timestamp] - Message timestamp
 * @property {string} [type] - Message type
 * @property {object} [metadata] - Message metadata object (optional)
 * @property {object} [payload]
 */
export class BaseMessage {
    /**
     * The unique, time-encoded identifier of this message.
     * @type {string}
     */
    msgID;

    /**
     * The Unix timestamp (milliseconds) when the message was created.
     * @type {number}
     */
    timestamp;

    /**
     * The routing key that defines the message's purpose.
     * @type {string}
     */
    type;


    /**
     * Optional metadata, guaranteed to be an object.
     * @type {object}
     */
    metadata;

    /**
     * The actual data content of the message.
     * @type {object|string|number|boolean|null}
     */
    payload;


    /**
     * The unique identifier of the sending agent (e.g., 'main:UI').
     * @type {MessageAgent}
     */
    agent;


    /**
     * The unique identifier of the sending agent (e.g., 'main:UI').
     * @type {string}
     */
    agentID;

    /**
     * Optional identifier specifying the target recipient for Direct Messaging.
     * @type {string | null}
     */
    toAgent;



    /**
     * Creates a structured message object, enforcing the immutable trace IDs.
     * @constructor
     * @param {string| {agentID: string}} agent - The MessageAgent instance of the sender (MANDATORY).
     * @param {string} type - Defines the message's purpose (the routing key).
     * @param {object|string|number|boolean|null} [payload=null] - The data content of the message.
     * @param {object} [metadata={}] - Optional metadata object containing message specific context like type of request. Guaranteed to be an object.
     * @param {string|null} [toAgent=null] - Optional target AgentID for direct messaging.
     */
    constructor(agent, type, payload, metadata = {}, toAgent = null) {
        if (typeof type !== 'string' || type.length === 0) {
            throw new Error('BaseMessage requires a non-empty string type.');
        }

        const idObject = pushID.newObj({}); // Generate a new time-based Push ID object

        this.msgID = idObject.id;
        this.timestamp = idObject.date.getTime();
        this.type = type;
        this.payload = payload;
        this.agentID = getAgentID(agent);
        this.toAgent = toAgent;
        this.metadata = metadata; // Now defaults to {}
    }
}