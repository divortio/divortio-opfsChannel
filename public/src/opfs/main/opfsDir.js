/**
 * @fileoverview The OPFSDir class, a main thread-exclusive abstraction for managing
 * a directory within the Origin Private File System (OPFS) using ASYNCHRONOUS APIs.
 */

import {
    parsePath,
    getDirHandle // Canonical directory handle retrieval
} from '../lib/utils.js';

import { OPFSFile } from './opfsFile.js';
import { BaseOPFSEntity } from '../lib/baseOPFS.js';

/**
 * @typedef {import('../lib/utils.js').DirHandle} DirHandle
 * @typedef {import('../lib/utils.js').PathInfo} PathInfo
 * @typedef {string} FilePath
 * @typedef {import('../OPFSNotifier.js').OPFSNotifier} OPFSNotifier
 */

export class OPFSDir extends BaseOPFSEntity {

    /**
     * Promise resolving to the FileSystemDirectoryHandle. Lazy-loaded.
     * @private
     * @type {Promise<DirHandle>|null}
     */
    _dirHandlePromise = null;

    /**
     * Initializes the OPFSDir instance.
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
     * Uses the getDirHandle utility for asynchronous traversal.
     * @private
     * @param {boolean} [create=false] - Whether to ensure the directory and its parents exist.
     * @returns {Promise<DirHandle>}
     */
    async _getHandlePromise(create = false) {
        const wasCreated = create && !await this.exists;

        if (!this._dirHandlePromise || create) {
            this._dirHandlePromise = getDirHandle(this._path, create).catch(e => {
                this._dirHandlePromise = null;
                throw e;
            });
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
        const destDir = new OPFSDir(newPath, this.notifier); // Pass notifier
        // Force the destination directory path to be created (notifier handles creation event internally via _getHandlePromise)
        await destDir._getHandlePromise(true);

        // 2. List all contents
        const entries = await this.listFiles();

        // 3. Process entries
        for (const entry of entries) {
            const sourcePath = this._path + entry.name;
            const destPath = newPath + entry.name;

            if (entry.kind === 'file') {
                const sourceFile = new OPFSFile(sourcePath, this.notifier); // Pass notifier
                // OPFSFile.copy handles reading/writing and implicitly creates dest parents
                await sourceFile.copy(destPath);
            } else if (entry.kind === 'directory') {
                const sourceDir = new OPFSDir(sourcePath, this.notifier); // Pass notifier
                // Recursive call (ensure path ends with '/')
                await sourceDir._copyDirRecursive(destPath + '/');
            }
        }
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
        return new OPFSFile(filePath, this.notifier); // Pass notifier
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
        return new OPFSDir(dirPath, this.notifier); // Pass notifier
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
            return new OPFSFile(this._path + name, this.notifier); // Pass notifier
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
            return new OPFSDir(this._path + name, this.notifier); // Pass notifier
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

        // 2. Perform copy operation (copy handles creating the destination path)
        if (isFile) {
            await entry.copy(newPath); // copy uses the notifier
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
     * @returns {Promise<OPFSDir>} The new OPFSDir instance.
     */
    async copyDir(newPath) {
        if (!await this.exists) {
            throw new Error(`Cannot copy: Source directory ${this._path} does not exist.`);
        }

        const normalizedNewPath = newPath.endsWith('/') ? newPath : newPath + '/';
        // _copyDirRecursive ensures destination dir is created and notifies creation events
        await this._copyDirRecursive(normalizedNewPath);
        this._clearCache();

        return new OPFSDir(normalizedNewPath, this.notifier);
    }

    /**
     * Recursively moves this directory and all its contents to a new destination path.
     * @param {FilePath} newPath - The destination path for the new directory.
     * @returns {Promise<OPFSDir>} The new OPFSDir instance.
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
        const parentDir = new OPFSDir(dirname, this.notifier);

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
     * Returns an initialized OPFSDir instance for the parent directory. Cached.
     * @type {Promise<OPFSDir>}
     */
    get parent() {
        return this._getOrCache('parent', async () => {
            if (this._path === '/') {
                throw new Error('Cannot access parent of the root directory.');
            }
            const { dirname } = parsePath(this._path.slice(0, -1));
            // Pass the notifier to the parent directory instance
            return new OPFSDir(dirname, this.notifier);
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