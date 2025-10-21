/**
 * @fileoverview The OPFSWorkerDirectory class, a high-performance, worker-exclusive abstraction
 * for managing a directory within the Origin Private File System (OPFS).
 */

import {
    parsePath,
    getFileHandle,
    withSyncAccessHandle
} from '../lib/utils.js';

import { OPFSWorkerFile } from './opfsWorkerFile.js';
import { BaseOPFSEntity } from '../lib/baseOPFS.js'; // <-- NEW IMPORT (Must be imported from lib)

/**
 * @typedef {import('../lib/utils.js').FileHandle} FileHandle
 * @typedef {import('../lib/utils.js').SyncAccessHandle} SyncAccessHandle
 * @typedef {import('../lib/utils.js').PathInfo} PathInfo
 * @typedef {string} FilePath
 * @typedef {FileSystemDirectoryHandle} DirHandle
 * @typedef {import('../OPFSNotifier.js').OPFSNotifier} OPFSNotifier
 */

export class OPFSWorkerDirectory extends BaseOPFSEntity { // <-- EXTENDS BaseOPFSEntity

    /**
     * Promise resolving to the FileSystemDirectoryHandle. Lazy-loaded.
     * @private
     * @type {Promise<DirHandle>|null}
     */
    _dirHandlePromise = null;

    /**
     * Initializes the OPFSWorkerDirectory instance.
     * NOTE: This is a synchronous operation; no I/O is performed here.
     * @param {FilePath} directoryPath - The full path to the directory (e.g., '/data/images/').
     * @param {OPFSNotifier|null} [notifier=null] - The injected notifier instance.
     */
    constructor(directoryPath, notifier = null) {
        // Call BaseOPFSEntity(path, isDirectory, notifier)
        super(directoryPath, true, notifier);
    }

    // =========================================================================
    // Private Utilities
    // =========================================================================

    /**
     * Lazy-loads or retrieves the FileSystemDirectoryHandle promise.
     * @private
     * @param {boolean} [create=false] - Whether to ensure the directory and its parents exist.
     * @returns {Promise<DirHandle>}
     */
    async _getHandlePromise(create = false) {
        const wasCreated = create && !await this.exists;

        if (!this._dirHandlePromise || create) {
            this._dirHandlePromise = (async () => {
                const parts = this._path.split('/').filter(p => p.length > 0);

                let dir = await navigator.storage.getDirectory();

                for (const part of parts) {
                    // Create the directory if requested/needed during traversal
                    dir = await dir.getDirectoryHandle(part, { create });
                }
                return dir;
            })();
        }

        // Notification Logic
        if (wasCreated && this.notifier) {
            this.notifier.dirCreated(this.path);
        }

        return this._dirHandlePromise;
    }

    /**
     * @private
     * Recursively copies the contents of this directory to a new directory path.
     * @param {FilePath} newPath - The full path of the destination directory (must end with '/').
     * @returns {Promise<void>}
     */
    async _copyDirRecursive(newPath) {
        // 1. Get the destination directory (creates it and its parents if needed)
        const destDir = new OPFSWorkerDirectory(newPath, this.notifier); // Pass notifier
        // Force the destination directory path to be created (notifier handles creation event internally via _getHandlePromise)
        await destDir._getHandlePromise(true);

        // 2. List all contents
        const entries = await this.listFiles();

        // 3. Process entries
        for (const entry of entries) {
            const sourcePath = this._path + entry.name;
            const destPath = newPath + entry.name;

            if (entry.kind === 'file') {
                const sourceFile = new OPFSWorkerFile(sourcePath, this.notifier); // Pass notifier
                // OPFSWorkerFile.copy handles reading/writing and implicitly creates dest parents
                await sourceFile.copy(destPath);
            } else if (entry.kind === 'directory') {
                const sourceDir = new OPFSWorkerDirectory(sourcePath, this.notifier); // Pass notifier
                // Recursive call (ensure path ends with '/')
                await sourceDir._copyDirRecursive(destPath + '/');
            }
        }
    }


    // =========================================================================
    // Methods (Operations)
    // =========================================================================

    /**
     * Creates a new OPFSWorkerFile instance representing a file inside this directory.
     * NOTE: This is a SYNCHRONOUS, LAZY operation. No I/O is performed.
     * @param {string} filename - The name of the file (e.g., 'data.bin').
     * @returns {OPFSWorkerFile} A new, uninitialized file object.
     */
    createFile(filename) {
        if (!filename || filename.includes('/')) {
            throw new Error('Filename must be a simple name, not a path.');
        }
        const filePath = this._path + filename;
        return new OPFSWorkerFile(filePath, this.notifier); // Pass notifier
    }

    /**
     * Creates a new OPFSWorkerDirectory instance representing a subdirectory.
     * NOTE: This is a SYNCHRONOUS, LAZY operation. No I/O is performed.
     * @param {string} dirname - The name of the subdirectory (e.g., 'archives').
     * @returns {OPFSWorkerDirectory} A new, uninitialized directory object.
     */
    createDir(dirname) {
        if (!dirname || dirname.includes('/')) {
            throw new Error('Directory name must be a simple name, not a path.');
        }
        const dirPath = this._path + dirname;
        return new OPFSWorkerDirectory(dirPath, this.notifier); // Pass notifier
    }

    /**
     * Attempts to retrieve a file entry by name.
     * @param {string} name - The name of the file.
     * @returns {Promise<OPFSWorkerFile|null>} The wrapped object, or null if not found.
     */
    async getFile(name) {
        const dirHandle = await this._getHandlePromise();

        try {
            await dirHandle.getFileHandle(name, { create: false });
            return new OPFSWorkerFile(this._path + name, this.notifier); // Pass notifier
        } catch (e) {
            if (e.name === 'NotFoundError') {
                return null;
            }
            throw e;
        }
    }

    /**
     * Attempts to retrieve a subdirectory entry by name.
     * @param {string} name - The name of the subdirectory.
     * @returns {Promise<OPFSWorkerDirectory|null>} The directory object, or null if not found.
     */
    async getDir(name) {
        const dirHandle = await this._getHandlePromise();

        try {
            await dirHandle.getDirectoryHandle(name, { create: false });
            return new OPFSWorkerDirectory(this._path + name, this.notifier); // Pass notifier
        } catch (e) {
            if (e.name === 'NotFoundError') {
                return null;
            }
            throw e;
        }
    }

    /**
     * Deletes a file or directory inside this directory.
     * @param {string} name - The name of the file or directory.
     * @param {boolean} [recursive=false] - Required to delete non-empty directories.
     * @returns {Promise<void>}
     */
    async deleteFile(name, recursive = false) {
        if (name === '' || name === '.') {
            throw new Error('Cannot delete the current directory via deleteFile.');
        }

        const deletedPath = this._path + name;

        const dirHandle = await this._getHandlePromise();
        await dirHandle.removeEntry(name, { recursive });
        this._clearCache();

        // Notification Logic
        if (this.notifier) {
            if (recursive) {
                this.notifier.dirDeleted(deletedPath);
            } else {
                this.notifier.fileDeleted(deletedPath);
            }
        }
    }

    /**
     * Deletes a directory and all its contents recursively.
     * @param {string} name - The name of the subdirectory to delete.
     * @returns {Promise<void>}
     */
    async deleteDir(name) {
        return this.deleteFile(name, true);
    }

    /**
     * Moves a file from this directory to a new path.
     * NOTE: This method currently only supports files. Use moveDir for recursive directory moves.
     * @param {string} name - The name of the file to move.
     * @param {FilePath} newPath - The destination path (full file path).
     * @returns {Promise<void>}
     */
    async moveFile(name, newPath) {
        const sourcePath = this._path + name;

        // 1. Determine type and existence (I/O)
        let entry = await this.getFile(name);
        let isFile = true;

        if (!entry) {
            entry = await this.getDir(name);
            isFile = false;
        }

        if (!entry) {
            throw new Error(`Cannot move: Entry "${name}" not found in ${this._path}`);
        }

        // 2. Perform copy operation
        if (isFile) {
            const file = new OPFSWorkerFile(sourcePath, this.notifier); // Pass notifier
            await file.copy(newPath);
        } else {
            throw new Error(`Cannot move directory "${name}". Use moveDir for recursive directory moves.`);
        }

        // 3. Delete the original (I/O). The delete method notifies deletion.
        await this.deleteFile(name, true);
        this._clearCache();

        // Notification Logic for the move event itself
        if (this.notifier) {
            this.notifier.entryMoved(sourcePath, newPath, 'file');
        }
    }

    /**
     * Recursively copies this directory and all its contents to a new destination path.
     * @param {FilePath} newPath - The destination path for the new directory.
     * @returns {Promise<OPFSWorkerDirectory>} The new OPFSWorkerDirectory instance.
     */
    async copyDir(newPath) {
        if (!await this.exists) {
            throw new Error(`Cannot copy: Source directory ${this._path} does not exist.`);
        }
        const normalizedNewPath = newPath.endsWith('/') ? newPath : newPath + '/';
        await this._copyDirRecursive(normalizedNewPath);
        this._clearCache();

        // The recursive copy helper already notified creation of the destination dir
        return new OPFSWorkerDirectory(normalizedNewPath, this.notifier);
    }

    /**
     * Recursively moves this directory and all its contents to a new destination path.
     * @param {FilePath} newPath - The destination path for the new directory.
     * @returns {Promise<OPFSWorkerDirectory>} The new OPFSWorkerDirectory instance.
     */
    async moveDir(newPath) {
        if (this._path === '/') {
            throw new Error('Cannot move the root directory.');
        }

        const oldPath = this.path;

        // 1. Perform recursive copy
        const newDir = await this.copyDir(newPath);

        // 2. Delete original directory
        const { dirname } = parsePath(this._path.slice(0, -1));
        const parentDir = new OPFSWorkerDirectory(dirname, this.notifier); // Pass notifier

        const dirNameSegment = this._path.slice(dirname.length).slice(0, -1);

        // deleteDir notifies deletion internally
        await parentDir.deleteDir(dirNameSegment);

        this._clearCache();

        // Notification Logic for the move event itself
        if (this.notifier) {
            this.notifier.entryMoved(oldPath, newDir.path, 'directory');
        }

        return newDir;
    }

    /**
     * Lists the names and types of all files and directories inside this directory.
     * @returns {Promise<Array<{name: string, kind: ('file'|'directory')}>>}
     */
    async listFiles() {
        return this._getOrCache('files', async () => {
            const dirHandle = await this._getHandlePromise();
            const results = [];

            // Iterate the async iterator provided by dirHandle.entries()
            for await (const [name, handle] of dirHandle.entries()) {
                results.push({
                    name: name,
                    kind: handle.kind
                });
            }
            return results;
        });
    }


    // =========================================================================
    // Properties (Cached Asynchronous Getters)
    // =========================================================================

    /**
     * Returns an initialized OPFSWorkerDirectory instance for the parent directory. Cached.
     * @type {Promise<OPFSWorkerDirectory>}
     */
    get parent() {
        return this._getOrCache('parent', async () => {
            if (this._path === '/') {
                throw new Error('Cannot access parent of the root directory.');
            }
            const { dirname } = parsePath(this._path.slice(0, -1));
            // Pass the notifier to the parent directory instance
            return new OPFSWorkerDirectory(dirname, this.notifier);
        });
    }

    /**
     * True if the directory exists, false otherwise. Cached.
     * @type {Promise<boolean>}
     */
    get exists() {
        return this._getOrCache('exists', async () => {
            try {
                await this._getHandlePromise(false);
                return true;
            } catch (error) {
                return false;
            }
        });
    }

    /**
     * The total number of files and directories in this directory. Cached.
     * @type {Promise<number>}
     */
    get count() {
        return this._getOrCache('count', async () => {
            const files = await this.listFiles();
            return files.length;
        });
    }

    /**
     * True if the directory contains no files or subdirectories. Cached.
     * @type {Promise<boolean>}
     */
    get isEmpty() {
        return this._getOrCache('isEmpty', async () => {
            const count = await this.count;
            return count === 0;
        });
    }
}