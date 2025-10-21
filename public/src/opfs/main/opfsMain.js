/**
 * @fileoverview Defines the OPFSMain class, a high-level facade for all asynchronous
 * Origin Private File System operations accessible from the Main Thread.
 */

import { OPFSFile } from './opfsFile.js';
import { OPFSDir } from './opfsDir.js';
import { parsePath } from '../lib/utils.js';
import { OPFSNotifier } from '../OPFSNotifier.js'; // <-- Dependency on OPFSNotifier

/**
 * @typedef {string} FilePath
 * @typedef {ArrayBuffer|Uint8Array|ArrayBufferView} WriteData
 * @typedef {object} EntryInfo
 * @property {string} name
 * @property {'file'|'directory'} kind
 */

export class OPFSMain {
    /**
     * The single OPFSNotifier instance used by all entities created by this facade.
     * @type {OPFSNotifier}
     */
    _notifier;

    /**
     * Initializes the OPFS Main Thread Façade.
     * @param {string|null} [agentName=null] - Optional name for this context (e.g., 'UI').
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
     * @returns {OPFSFile|OPFSDir}
     */
    getEntry(path) {
        // CRITICAL: Inject the single notifier instance into the entity constructor
        if (path.endsWith('/') || path === '/') {
            return new OPFSDir(path, this._notifier);
        } else {
            return new OPFSFile(path, this._notifier);
        }
    }

    /**
     * Provides access to the global notification channel for the application to register listeners.
     * @returns {OPFSNotifier}
     */
    get notifier() {
        return this._notifier;
    }

    // =========================================================================
    // I/O Operations (Delegated methods use getEntry(path))
    // =========================================================================

    /**
     * Checks if a file or directory exists at the given path.
     * @param {FilePath} path - The full path.
     * @returns {Promise<boolean>}
     */
    async exists(path) {
        return this.getEntry(path).exists;
    }

    /**
     * Reads the entire content of a file into a Uint8Array.
     * @param {FilePath} filePath - The full path to the file.
     * @returns {Promise<Uint8Array>}
     */
    async read(filePath) {
        return new OPFSFile(filePath, this._notifier).readBytes();
    }

    /**
     * Writes data to a file, automatically creating parent directories as needed.
     * @param {FilePath} filePath - The full path to the file.
     * @param {WriteData} data - The data to write.
     * @param {number} [position=0] - Byte offset to start writing at.
     * @returns {Promise<void>}
     */
    async write(filePath, data, position = 0) {
        return new OPFSFile(filePath, this._notifier).writeBytes(data, position);
    }

    /**
     * Calculates the memory-safe, streaming SHA-256 hash of a file.
     * @param {FilePath} filePath - The full path to the file.
     * @returns {Promise<string>} Hexadecimal SHA-256 hash.
     */
    async hash(filePath) {
        return new OPFSFile(filePath, this._notifier).sha256;
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
        return new OPFSDir(dirPath, this._notifier).listFiles();
    }

    /**
     * Ensures the given directory path and all its parents exist.
     * @param {FilePath} dirPath - The full path to the directory.
     * @returns {Promise<void>}
     */
    async makeDir(dirPath) {
        // We use the underlying OPFSDir method that handles creation and notification internally.
        await new OPFSDir(dirPath, this._notifier)._getHandlePromise(true);
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

        if (entry instanceof OPFSFile) {
            return entry.delete();
        } else if (entry instanceof OPFSDir) {
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
     * @returns {Promise<OPFSFile|OPFSDir>} The new copied entity object.
     */
    async copy(sourcePath, destPath) {
        const entry = this.getEntry(sourcePath);

        if (entry instanceof OPFSFile) {
            return entry.copy(destPath);
        } else if (entry instanceof OPFSDir) {
            return entry.copyDir(destPath);
        }
    }

    /**
     * Moves a file or recursively moves a directory to a new destination.
     * @param {FilePath} sourcePath - The source path.
     * @param {FilePath} destPath - The destination path.
     * @returns {Promise<OPFSFile|OPFSDir>} The new moved entity object.
     */
    async move(sourcePath, destPath) {
        const entry = this.getEntry(sourcePath);

        if (entry instanceof OPFSFile) {
            return entry.move(destPath);
        } else if (entry instanceof OPFSDir) {
            return entry.moveDir(destPath);
        }
    }
}