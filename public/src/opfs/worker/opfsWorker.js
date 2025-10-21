/**
 * @fileoverview Defines the OPFSWorker class, a high-level facade for all synchronous
 * Origin Private File System operations accessible from the Web Worker context.
 */

import { OPFSWorkerFile } from './opfsWorkerFile.js';
import { OPFSWorkerDirectory } from './opfsWorkerDir.js';
import { parsePath } from '../lib/utils.js';
import { OPFSNotifier } from '../OPFSNotifier.js'; // <-- NEW IMPORT

/**
 * @typedef {string} FilePath
 * @typedef {Uint8Array} WriteData
 * @typedef {object} EntryInfo
 * @property {string} name
 * @property {'file'|'directory'} kind
 */

export class OPFSWorker {

    /**
     * The single OPFSNotifier instance used by all entities created by this facade.
     * @type {OPFSNotifier}
     */
    _notifier;

    /**
     * Initializes the OPFS Worker Thread Façade.
     * @param {string|null} [agentName=null] - Optional name for this context (e.g., 'IOWorker').
     */
    constructor(agentName = null) {
        // CRITICAL: Initialize the single notification channel instance
        this._notifier = new OPFSNotifier(agentName);
    }

    // =========================================================================
    // Entry Retrieval (The core factory method)
    // =========================================================================

    /**
     * Retrieves the specific, fully initialized OPFS object for a given path,
     * injecting the single notifier instance for event emission.
     * @param {FilePath} path - The full path to the file or directory.
     * @returns {OPFSWorkerFile|OPFSWorkerDirectory}
     */
    getEntry(path) {
        // CRITICAL: Inject the single notifier instance into the entity constructor
        if (path.endsWith('/') || path === '/') {
            return new OPFSWorkerDirectory(path, this._notifier);
        } else {
            return new OPFSWorkerFile(path, this._notifier);
        }
    }

    /**
     * Provides access to the global notification channel for the application to register listeners.
     * @returns {OPFSNotifier}
     */
    get notifier() {
        return this._notifier;
    }

    /**
     * Checks if a file or directory exists at the given path.
     * @param {FilePath} path - The full path.
     * @returns {Promise<boolean>}
     */
    async exists(path) {
        return this.getEntry(path).exists;
    }

    // =========================================================================
    // I/O Operations (File-specific)
    // =========================================================================

    /**
     * Reads the entire content of a file into a Uint8Array.
     * @param {FilePath} filePath - The full path to the file.
     * @returns {Promise<Uint8Array>}
     */
    async read(filePath) {
        // Call factory method to ensure notifier injection occurs
        return this.getEntry(filePath).readBytes();
    }

    /**
     * Writes data to a file, automatically creating parent directories as needed.
     * @param {FilePath} filePath - The full path to the file.
     * @param {WriteData} data - The Uint8Array data to write.
     * @param {number} [position=0] - Byte offset to start writing at.
     * @returns {Promise<void>}
     */
    async write(filePath, data, position = 0) {
        // Call factory method to ensure notifier injection occurs
        return this.getEntry(filePath).writeBytes(data, position);
    }

    /**
     * Calculates the SHA-256 hash of a file.
     * @param {FilePath} filePath - The full path to the file.
     * @returns {Promise<string>} Hexadecimal SHA-256 hash.
     */
    async hash(filePath) {
        return this.getEntry(filePath).sha256;
    }

    // =========================================================================
    // Directory Operations
    // =========================================================================

    /**
     * Lists the contents (files and directories) of a directory.
     * @param {FilePath} dirPath - The full path to the directory (e.g., '/data/').
     * @returns {Promise<EntryInfo[]>}
     */
    async list(dirPath) {
        return this.getEntry(dirPath).listFiles();
    }

    /**
     * Ensures the given directory path and all its parents exist.
     * @param {FilePath} dirPath - The full path to the directory.
     * @returns {Promise<void>}
     */
    async makeDir(dirPath) {
        // Use factory method to ensure notifier is injected before calling I/O
        await this.getEntry(dirPath)._getHandlePromise(true);
    }

    // =========================================================================
    // Lifecycle Operations
    // =========================================================================

    /**
     * Deletes a file or directory. For directories, recursive deletion is always used.
     * @param {FilePath} path - The full path to the entity.
     * @returns {Promise<void>}
     */
    async delete(path) {
        const entry = this.getEntry(path);

        if (entry instanceof OPFSWorkerFile) {
            return entry.delete();
        } else if (entry instanceof OPFSWorkerDirectory) {
            // Delete the directory itself from its parent
            if (path === '/') {
                throw new Error('Cannot delete the root directory.');
            }
            const { filename } = parsePath(path.slice(0, -1));
            const parentDir = await entry.parent;
            return parentDir.deleteDir(filename);
        }
    }

    /**
     * Copies a file or recursively copies a directory to a new destination.
     * @param {FilePath} sourcePath - The source path.
     * @param {FilePath} destPath - The destination path.
     * @returns {Promise<OPFSWorkerFile|OPFSWorkerDirectory>} The new copied entity object.
     */
    async copy(sourcePath, destPath) {
        const entry = this.getEntry(sourcePath);

        if (entry instanceof OPFSWorkerFile) {
            return entry.copy(destPath);
        } else if (entry instanceof OPFSWorkerDirectory) {
            return entry.copyDir(destPath);
        }
    }

    /**
     * Moves a file or recursively moves a directory to a new destination.
     * @param {FilePath} sourcePath - The source path.
     * @param {FilePath} destPath - The destination path.
     * @returns {Promise<OPFSWorkerFile|OPFSWorkerDirectory>} The new moved entity object.
     */
    async move(sourcePath, destPath) {
        const entry = this.getEntry(sourcePath);

        if (entry instanceof OPFSWorkerFile) {
            return entry.move(destPath);
        } else if (entry instanceof OPFSWorkerDirectory) {
            return entry.moveDir(destPath);
        }
    }
}