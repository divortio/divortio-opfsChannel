/**
 * @fileoverview Defines the MainOPFSChannel class, a specialized AsyncChannel for the Main Thread
 * that abstracts file operations by requesting them from the Web Worker context.
 * It coordinates with the WorkerOPFSChannel counterpart.
 */
import { AsyncChannel } from '../../msgChannels/channels/async.js';
import { OPFSFile } from './opfsFile.js'; // Use Main Thread OPFS classes for local representation

/**
 * @typedef {import('../../msgChannels/messages/messageAgent.js').MessageAgent} MessageAgent
 * @typedef {string} FilePath
 */


export class MainOPFSChannel extends AsyncChannel {

    /**
     * The specific channel name used for OPFS-related request/response communication.
     * @type {string}
     */
    static CHANNEL_NAME = 'opfs_io_request_channel';

    /**
     * Initializes the MainOPFSChannel.
     * @param {string|null} [agentName=null] - Optional name for this context (e.g., 'UI').
     */
    constructor(agentName = null) {
        super(MainOPFSChannel.CHANNEL_NAME, agentName);
    }

    /**
     * Requests the Web Worker to read the entire file content.
     * @param {FilePath} filePath - The path to the file.
     * @returns {Promise<ArrayBuffer>} Resolves with the file content as an ArrayBuffer.
     */
    async requestRead(filePath) {
        if (typeof filePath !== 'string' || !filePath) {
            throw new Error('File path is required for read request.');
        }
        return this.request('opfs_read_file', { filePath });
    }

    /**
     * Requests the Web Worker to write data to a file path.
     * The ArrayBuffer is transferred to the worker for the synchronous OPFS write.
     * @param {FilePath} filePath - The path to the file.
     * @param {ArrayBuffer|Uint8Array} data - The data to write.
     * @param {number} [position=0] - The byte offset.
     * @returns {Promise<void>}
     */
    async requestWrite(filePath, data, position = 0) {
        if (!(data instanceof ArrayBuffer || data instanceof Uint8Array)) {
            throw new TypeError('Data must be an ArrayBuffer or Uint8Array.');
        }

        // Determine the transferable buffer
        const buffer = data instanceof Uint8Array ? data.buffer : data;

        // Request the worker to write. Transfer the buffer for zero-copy efficiency.
        return this.request(
            'opfs_write_file',
            { filePath, position, buffer: buffer },
            null, // No specific target agent
            [buffer] // The ArrayBuffer is the transferable object
        );
    }

    /**
     * Requests the Web Worker to delete a file or directory.
     * @param {FilePath} path - The path to the entry (file or directory).
     * @param {boolean} [recursive=false] - Required for non-empty directories.
     * @returns {Promise<void>}
     */
    async requestDelete(path, recursive = false) {
        return this.request('opfs_delete_entry', { path, recursive });
    }

    /**
     * Requests the Web Worker to recursively copy a directory.
     * @param {FilePath} sourcePath - The path to the source directory.
     * @param {FilePath} destPath - The path to the destination directory.
     * @returns {Promise<void>}
     */
    async requestCopyDir(sourcePath, destPath) {
        return this.request('opfs_copy_dir', { sourcePath, destPath });
    }

    /**
     * Requests the Web Worker to recursively move a directory.
     * @param {FilePath} sourcePath - The path to the source directory.
     * @param {FilePath} destPath - The path to the destination directory.
     * @returns {Promise<void>}
     */
    async requestMoveDir(sourcePath, destPath) {
        return this.request('opfs_move_dir', { sourcePath, destPath });
    }
}