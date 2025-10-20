/**
 * @fileoverview Defines the MessageAgent class, which encapsulates the logic
 * for determining the execution context (scope, name) and generating a stable agentID.
 * This class ensures consistency across Main Thread and Worker contexts.
 */

import { pushID } from '../../vendor/pushID.js';


export class MessageAgent {

    /**
     * The scope of the agent (e.g., 'main' or 'worker').
     * @type {string}
     */
    agentScope;

    /**
     * The unique identifier of the agent (e.g., 'main:UI' or 'worker:0QZ7qGgA').
     * @type {string}
     */
    agentID;

    /**
     * Initializes the MessageAgent, determining the execution scope and generating
     * the agentID based on the provided name or robust defaults.
     * @param {string | null} [agentName=null] - Optional human-friendly name for this context (e.g., 'UI').
     */
    constructor(agentName = null) {
        this.agentScope = this._determineScope();
        this.agentID = this._generateAgentID(agentName);
    }

    /**
     * Determines the current execution context (Main Thread or Worker).
     * @private
     * @returns {string}
     */
    _determineScope() {
        // self is defined in workers, and WorkerGlobalScope is the type name.
        if (typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
            return 'worker';
        }
        return 'main';
    }

    /**
     * Generates the final agentID string based on scope and provided name.
     * The final ID is always formatted as 'scope:name'.
     * @private
     * @param {string | null} preferredName - The name provided by the user.
     * @returns {string} The generated agent ID (e.g., 'main:UI' or 'worker:0QZ7qGgA').
     */
    _generateAgentID(preferredName) {
        let name;

        if (preferredName && typeof preferredName === 'string' && preferredName.length > 0) {
            // Priority 1: Use the developer-provided name
            name = preferredName;

        } else if (this.agentScope === 'worker' && self.name && self.name.length > 0) {
            // Priority 2: Use the Worker's native name (e.g., if set by new Worker(..., {name: 'MyWorker'}))
            name = self.name;

        } else {
            // Fallback: Generate a unique Push ID or use a generic identifier
            if (this.agentScope === 'main') {
                // Main thread fallback uses a generic, static name
                name = 'main';
            } else {
                // Worker fallback generates a unique Push ID to ensure traceability
                name = pushID.newID({length: 10, stub: null});
            }
        }

        // Concatenate to form the final agentID (e.g., 'worker:0QZ7qGgA')
        return `${this.agentScope}:${name}`;
    }
}