/**
 * @fileoverview The OPFSDir class, a main thread-exclusive abstraction for managing
 * a directory within the Origin Private File System (OPFS) using ASYNCHRONOUS APIs.
 */

import {
    parsePath,
    getDirHandle // Canonical directory handle retrieval
} from '../lib/utils.js';

import { OPFSFile } from './opfsFile.js';

/**
 * @typedef {import('../lib/utils.js').DirHandle} DirHandle
 * @typedef {import('../lib/utils.js').PathInfo} PathInfo
 * @typedef {string} FilePath
 */

export class OPFSDir {

    /**
     * Internal Map to cache expensive property results (e.g., exists, count).
     * @private
     * @type {Map<string, any>}
     */
    _cache = new Map();

    /**
     * Promise resolving to the FileSystemDirectoryHandle. Lazy-loaded.
     * @private
     * @type {Promise<DirHandle>|null}
     */
    _dirHandlePromise = null;

    /**
     * The full path to the directory (always ends with '/').
     * @private
     * @type {FilePath}
     */
    _path = '';

    /**
     * Initializes the OPFSDir instance.
     * NOTE: This is a synchronous operation; no I/O is performed here.
     * @param {FilePath} directoryPath - The full path to the directory (e.g., '/data/images/').
     */
    constructor(directoryPath) {
        if (typeof directoryPath !== 'string' || !directoryPath) {
            throw new Error('OPFSDir requires a non-empty directory path.');
        }
        // Normalize path to ensure it ends with a slash, unless it's the root.
        this._path = directoryPath.endsWith('/') ? directoryPath : directoryPath + '/';
    }

    // =========================================================================
    // Private Utilities
    // =========================================================================

    /**
     * Clears the property cache for values invalidated by modification or deletion.
     * @private
     */
    _clearCache() {
        this._cache.delete('exists');
        this._cache.delete('count');
        this._cache.delete('isEmpty');
        this._cache.delete('files'); // The list of entries
    }

    /**
     * Retrieves the cached value for a key, or computes and caches it using a generator function.
     * @private
     * @param {string} key - The cache key.
     * @param {function(): Promise<any>} generatorFn - The asynchronous function to run if the key is not in cache.
     * @returns {Promise<any>}
     */
    async _getOrCache(key, generatorFn) {
        if (this._cache.has(key)) {
            return this._cache.get(key);
        }
        const result = await generatorFn();
        this._cache.set(key, result);
        return result;
    }

    /**
     * Lazy-loads or retrieves the FileSystemDirectoryHandle promise.
     * Uses the getDirHandle utility for asynchronous traversal.
     * @private
     * @param {boolean} [create=false] - Whether to ensure the directory and its parents exist.
     * @returns {Promise<DirHandle>}
     */
    async _getHandlePromise(create = false) {
        if (!this._dirHandlePromise || create) {
            this._dirHandlePromise = getDirHandle(this._path, create).catch(e => {
                this._dirHandlePromise = null;
                throw e;
            });
        }
        return this._dirHandlePromise;
    }


    // =========================================================================
    // Methods (Operations)
    // =========================================================================

    /**
     * Creates a new OPFSFile instance representing a file inside this directory.
     * NOTE: This is a SYNCHRONOUS, LAZY operation. No I/O is performed.
     * @param {string} filename - The name of the file (e.g., 'data.bin').
     * @returns {OPFSFile} A new, uninitialized file object.
     */
    createFile(filename) {
        if (!filename || filename.includes('/')) {
            throw new Error('Filename must be a simple name, not a path.');
        }
        const filePath = this._path + filename;
        return new OPFSFile(filePath);
    }

    /**
     * Creates a new OPFSDir instance representing a subdirectory.
     * NOTE: This is a SYNCHRONOUS, LAZY operation. No I/O is performed.
     * @param {string} dirname - The name of the subdirectory (e.g., 'archives').
     * @returns {OPFSDir} A new, uninitialized directory object.
     */
    createDir(dirname) {
        if (!dirname || dirname.includes('/')) {
            throw new Error('Directory name must be a simple name, not a path.');
        }
        const dirPath = this._path + dirname;
        return new OPFSDir(dirPath);
    }

    /**
     * Attempts to retrieve a file entry by name.
     * @param {string} name - The name of the file.
     * @returns {Promise<OPFSFile|null>} The wrapped object, or null if not found.
     */
    async getFile(name) {
        // We only attempt to get the handle if the directory is expected to exist
        if (!await this.exists) return null;
        const dirHandle = await this._getHandlePromise();

        try {
            // Check if it exists AND is a file
            await dirHandle.getFileHandle(name, { create: false });
            return new OPFSFile(this._path + name);
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
     * @returns {Promise<OPFSDir|null>} The directory object, or null if not found.
     */
    async getDir(name) {
        // We only attempt to get the handle if the directory is expected to exist
        if (!await this.exists) return null;
        const dirHandle = await this._getHandlePromise();

        try {
            // Check if it exists AND is a directory
            await dirHandle.getDirectoryHandle(name, { create: false });
            return new OPFSDir(this._path + name);
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
        if (!await this.exists) {
            throw new Error(`Cannot delete: Directory ${this._path} does not exist.`);
        }
        const dirHandle = await this._getHandlePromise();
        await dirHandle.removeEntry(name, { recursive });
        this._clearCache();
    }

    /**
     * Moves a file from this directory to a new path.
     * NOTE: This is implemented as copy-then-delete, and currently only supports files.
     * @param {string} name - The name of the file to move.
     * @param {FilePath} newPath - The destination path (full file path).
     * @returns {Promise<void>}
     */
    async moveFile(name, newPath) {
        const sourcePath = this._path + name;
        if (!await this.exists) {
            throw new Error(`Cannot move: Source directory ${this._path} does not exist.`);
        }

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
            // entry is an OPFSFile instance, use its copy method
            await entry.copy(newPath);
        } else {
            // NOTE: Directory move requires recursive copy logic (future implementation)
            throw new Error(`Directory move not currently supported. Use list/copy/delete for contents.`);
        }

        // 3. Delete the original (I/O)
        // Use recursive true for safety, although the original file is empty now.
        await this.deleteFile(name, true);
        this._clearCache();
    }

    /**
     * Lists the names and types of all files and directories inside this directory.
     * @returns {Promise<Array<{name: string, kind: ('file'|'directory')}>>}
     */
    async listFiles() {
        return this._getOrCache('files', async () => {
            if (!await this.exists) return [];
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
     * Gets the full, normalized path of this directory. Synchronous.
     * @type {FilePath}
     */
    get path() {
        return this._path;
    }

    /**
     * Gets the name of the directory itself (e.g., 'images/'). Synchronous.
     * @type {string}
     */
    get dirname() {
        const { dirname } = parsePath(this._path.slice(0, -1)); // Parse parent path
        return this._path.slice(dirname.length); // Return the final segment
    }

    /**
     * Returns an initialized OPFSDir instance for the parent directory. Cached.
     * @type {Promise<OPFSDir>}
     */
    get parent() {
        return this._getOrCache('parent', async () => {
            if (this._path === '/') {
                throw new Error('Cannot access parent of the root directory.');
            }
            const { dirname } = parsePath(this._path.slice(0, -1));
            return new OPFSDir(dirname);
        });
    }

    /**
     * True if the directory exists, false otherwise. Cached.
     * @type {Promise<boolean>}
     */
    get exists() {
        return this._getOrCache('exists', async () => {
            try {
                // Attempt to get the handle without creating it
                await this._getHandlePromise(false);
                return true;
            } catch (error) {
                // If getDirectoryHandle fails (NotFoundError)
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