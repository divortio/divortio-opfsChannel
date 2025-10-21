/**
 * @fileoverview Defines the WorkerOPFSChannel class, a specialized AsyncChannel for the Web Worker
 * that implements the handlers for file I/O requests using synchronous OPFS APIs.
 * It coordinates with the MainOPFSChannel counterpart.
 */
import { AsyncChannel } from '../../msgChannels/channels/async.js';
import { OPFSWorker } from './opfsWorker.js'; // <-- Import the Facade for simplified I/O logic

/**
 * @typedef {import('../../msgChannels/messages/messageAgent.js').MessageAgent} MessageAgent
 * @typedef {string} FilePath
 */


export class WorkerOPFSChannel extends AsyncChannel {

    /**
     * The specific channel name used for OPFS-related request/response communication.
     * @type {string}
     */
    static CHANNEL_NAME = 'opfs_io_request_channel';

    /**
     * High-level facade for synchronous file system operations.
     * @type {OPFSWorker}
     * @private
     */
    _opfsFacade;

    /**
     * Initializes the WorkerOPFSChannel and sets up all request handlers.
     * @param {string|null} [agentName=null] - Optional name for this context (e.g., 'IOWorker').
     */
    constructor(agentName = null) {
        super(WorkerOPFSChannel.CHANNEL_NAME, agentName);

        // Initialize the OPFS facade. The notifier is automatically instantiated inside the facade.
        this._opfsFacade = new OPFSWorker(agentName);
        this._setupHandlers();
    }

    /**
     * Registers all specialized request handlers for file operations.
     * @private
     */
    _setupHandlers() {
        const facade = this._opfsFacade;

        // --- 1. File Read Handler ---
        this.onRequest('opfs_read_file', async (payload) => {
            // Returns Uint8Array whose buffer is automatically transferred/copied
            const data = await facade.read(payload.filePath);

            // Return the underlying ArrayBuffer for transfer efficiency
            return data.buffer;
        });

        // --- 2. File Write Handler ---
        this.onRequest('opfs_write_file', async (payload) => {
            const { filePath, position = 0, buffer } = payload;

            if (!(buffer instanceof ArrayBuffer)) {
                throw new TypeError('Payload must contain an ArrayBuffer (buffer) for writing.');
            }

            const data = new Uint8Array(buffer);
            await facade.write(filePath, data, position);
            return { success: true };
        });

        // --- 3. Entry Delete Handler (File or Directory) ---
        this.onRequest('opfs_delete_entry', async (payload) => {
            const { path } = payload;

            // Facade's delete method already handles type and recursive deletion internally
            await facade.delete(path);
            return { success: true };
        });

        // --- 4. Directory Copy Handler ---
        this.onRequest('opfs_copy_dir', async (payload) => {
            const { sourcePath, destPath } = payload;
            await facade.copy(sourcePath, destPath);
            return { success: true };
        });

        // --- 5. Directory Move Handler ---
        this.onRequest('opfs_move_dir', async (payload) => {
            const { sourcePath, destPath } = payload;
            await facade.move(sourcePath, destPath);
            return { success: true };
        });
    }

    /**
     * Provides direct access to the Worker's OPFS Façade instance.
     * @returns {OPFSWorker}
     */
    get opfs() {
        return this._opfsFacade;
    }
}