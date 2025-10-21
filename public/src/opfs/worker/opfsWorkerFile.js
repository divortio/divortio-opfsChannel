/**
 * @fileoverview The OPFSWorkerFile class, a high-performance, worker-exclusive abstraction
 * over the Origin Private File System (OPFS) using synchronous I/O and property caching.
 * It integrates with OPFSWorkerDirectory for path management.
 */
import {
    parsePath,
    getFileHandle,
    withSyncAccessHandle,
    calculateSHA256,
    getMimeType,
    bytesToHumanReadable
    // deleteFileEntry is removed as delete now uses parentDir.deleteFile()
} from '../lib/utils.js';

import { OPFSWorkerDirectory } from './opfsWorkerDir.js';
import { BaseOPFSEntity } from '../lib/baseOPFS.js'; // <-- NEW IMPORT (Must be imported from lib)

/**
 * @typedef {import('../lib/utils.js').FileHandle} FileHandle
 * @typedef {import('../lib/utils.js').SyncAccessHandle} SyncAccessHandle
 * @typedef {import('../lib/utils.js').PathInfo} PathInfo
 * @typedef {number} ByteOffset
 * @typedef {string} FilePath
 * @typedef {import('../OPFSNotifier.js').OPFSNotifier} OPFSNotifier
 */


export class OPFSWorkerFile extends BaseOPFSEntity { // <-- EXTENDS BaseOPFSEntity

    /**
     * Promise resolving to the FileSystemFileHandle. Lazy-loaded.
     * @private
     * @type {Promise<FileHandle>|null}
     */
    _fileHandlePromise = null;

    /**
     * The FileSystemSyncAccessHandle, held open only during an explicit 'update' call.
     * @private
     * @type {SyncAccessHandle|null}
     */
    _accessHandle = null;

    /**
     * Initializes the OPFSWorkerFile instance.
     * @param {FilePath} filePath - The full path to the file.
     * @param {OPFSNotifier|null} [notifier=null] - The injected notifier instance.
     */
    constructor(filePath, notifier = null) {
        // Call BaseOPFSEntity(path, isDirectory, notifier)
        super(filePath, false, notifier);
    }

    // =========================================================================
    // Private Utilities
    // =========================================================================

    /**
     * Lazy-loads or retrieves the FileSystemFileHandle promise.
     * Uses OPFSWorkerDirectory to ensure parent path exists and delegates file creation.
     * @private
     * @param {boolean} [forceCreation=false] - Whether to ensure parent directories and the file itself exist.
     * @returns {Promise<FileHandle>}
     */
    async _getHandlePromise(forceCreation = false) {
        if (!this._fileHandlePromise || forceCreation) {
            this._fileHandlePromise = (async () => {
                const { filename } = parsePath(this._path);
                if (!filename) {
                    throw new Error(`Cannot get handle: Path must include a filename.`);
                }

                // 1. Get the parent directory handle, creating the directory structure if requested
                const parentDir = await this.parentDir;
                const parentHandle = await parentDir._getHandlePromise(forceCreation);

                // 2. Get the file handle from the parent, applying the creation flag
                return await parentHandle.getFileHandle(filename, { create: forceCreation });
            })().catch(e => {
                this._fileHandlePromise = null;
                throw e;
            });
        }
        return this._fileHandlePromise;
    }

    // =========================================================================
    // Methods (Operations)
    // =========================================================================

    /**
     * Reads a segment of the file into a new Uint8Array.
     * @param {ByteOffset} [position=0] - The byte offset to start reading from.
     * @param {number} [length] - The number of bytes to read. Defaults to reading until EOF.
     * @returns {Promise<Uint8Array>}
     */
    async readBytes(position = 0, length) {
        if (!await this.exists) {
            throw new Error(`Cannot read: File does not exist at ${this._path}.`);
        }
        const handle = await this._getHandlePromise();

        return withSyncAccessHandle(handle, handle => {
            const size = handle.getSize();
            const readLength = length === undefined ? size - position : length;

            if (readLength <= 0 || position >= size) return new Uint8Array(0);

            const buffer = new Uint8Array(readLength);
            const bytesRead = handle.read(buffer, { at: position });

            return (bytesRead < readLength) ? buffer.subarray(0, bytesRead) : buffer;
        });
    }

    /**
     * Writes the contents of a Uint8Array to the file.
     * NOTE: This method implicitly creates parent directories if they do not exist.
     * @param {Uint8Array} data - The data to write.
     * @param {ByteOffset} [position=0] - The byte offset to start writing at.
     * @returns {Promise<void>}
     */
    async writeBytes(data, position = 0) {
        const fileExisted = await this.exists;

        // Force creation of file and parent directories if writing to a new path
        const handle = await this._getHandlePromise(true);

        await withSyncAccessHandle(handle, syncHandle => {
            const bytesWritten = syncHandle.write(data, { at: position });

            if (bytesWritten !== data.length) {
                throw new Error(`Failed to write all data. Wrote ${bytesWritten} of ${data.length} bytes.`);
            }

            if (position + data.length < syncHandle.getSize()) {
                syncHandle.truncate(position + data.length);
            }
        });
        this._clearCache();

        // Notification Logic
        if (this.notifier) {
            // Await the cached property fetch only after I/O is done
            const bytesH = await this.bytesH;
            if (!fileExisted) {
                this.notifier.fileCreated(this.path, bytesH);
            } else {
                this.notifier.fileModified(this.path, bytesH); // Modification includes overwrite/append
            }
        }
    }

    /**
     * Reads the entire file content into a new SharedArrayBuffer.
     * @returns {Promise<SharedArrayBuffer>}
     */
    async toSharedArrayBuffer() {
        if (!await this.exists) {
            throw new Error(`Cannot read to SharedArrayBuffer: File does not exist at ${this._path}.`);
        }

        const handle = await this._getHandlePromise();

        return withSyncAccessHandle(handle, handle => {
            const size = handle.getSize();
            const sab = new SharedArrayBuffer(size);
            const buffer = new Uint8Array(sab);

            const bytesRead = handle.read(buffer, { at: 0 });

            if (bytesRead !== size) {
                throw new Error(`Failed to read full file into SAB. Read ${bytesRead} of ${size} bytes.`);
            }
            return sab;
        });
    }

    /**
     * Writes the contents of a SharedArrayBuffer to the file.
     * @param {SharedArrayBuffer} sab - The SharedArrayBuffer.
     * @param {ByteOffset} [position=0] - The byte offset to start writing at.
     * @returns {Promise<void>}
     */
    async fromSharedArrayBuffer(sab, position = 0) {
        if (!(sab instanceof SharedArrayBuffer)) {
            throw new TypeError('Input must be a SharedArrayBuffer.');
        }
        const data = new Uint8Array(sab);
        return this.writeBytes(data, position);
    }

    /**
     * Creates an Object URL (Blob URL) for the file content.
     * @param {string} [mimeType] - Optional MIME type for the Blob. Defaults to derived type.
     * @returns {Promise<string>} The Blob URL.
     */
    async toBlobURL(mimeType) {
        const data = await this.readBytes();
        const type = mimeType || await this.mimetype;
        const blob = new Blob([data], { type });
        return URL.createObjectURL(blob);
    }

    /**
     * Fetches data from a Blob URL and writes it to the file.
     * @param {string} url - The Blob URL.
     * @returns {Promise<void>}
     */
    async fromBlobURL(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data from Blob URL: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);
        return this.writeBytes(data, 0);
    }

    /**
     * Deletes the file entry from OPFS, delegating to the parent directory.
     * @returns {Promise<void>}
     */
    async delete() {
        if (this._path === '/') {
            throw new Error('Cannot delete the root directory. Use deleteFile(name) on its parent.');
        }

        const deletedPath = this.path;

        this._clearCache();
        const { filename } = parsePath(this._path);

        const parentDir = await this.parentDir;
        await parentDir.deleteFile(filename);

        this._fileHandlePromise = null; // Invalidate handle

        // Notification Logic
        if (this.notifier) {
            this.notifier.fileDeleted(deletedPath);
        }
    }

    /**
     * Copies the file to a new path.
     * NOTE: This operation implicitly creates parent directories for the destination path.
     * @param {FilePath} newPath - The destination path.
     * @returns {Promise<OPFSWorkerFile>} A new instance representing the copied file.
     */
    async copy(newPath) {
        const data = await this.readBytes();
        // Pass notifier to the new file instance
        const newFile = new OPFSWorkerFile(newPath, this.notifier);
        await newFile.writeBytes(data, 0); // writeBytes handles creation notification
        return newFile;
    }

    /**
     * Moves the file to a new path (implemented as copy then delete).
     * NOTE: This operation implicitly creates parent directories for the destination path.
     * @param {FilePath} newPath - The destination path.
     * @returns {Promise<void>}
     */
    async move(newPath) {
        const oldPath = this.path;

        // Pass notifier to the copy operation
        await this.copy(newPath);

        // Delete the original (which notifies deletion internally)
        await this.delete();

        // Notification Logic for the move event itself
        if (this.notifier) {
            this.notifier.entryMoved(oldPath, newPath, 'file');
        }
    }

    /**
     * Pre-allocates disk space for the file by truncating its size.
     * @param {number} size - The target size in bytes.
     * @returns {Promise<void>}
     */
    async allocate(size) {
        if (typeof size !== 'number' || size < 0) {
            throw new TypeError('Size must be a non-negative number.');
        }
        const fileHandle = await this._getHandlePromise(true);

        await withSyncAccessHandle(fileHandle, h => {
            h.truncate(size);
        });

        this._clearCache();

        // Notification Logic: Allocation is a file modification
        if (this.notifier) {
            const bytesH = await this.bytesH;
            this.notifier.fileModified(this.path, bytesH);
        }
    }

    /**
     * Optimized method for batch synchronous I/O. Opens the access handle once for the callback.
     * @param {function(SyncAccessHandle): Promise<any>} callback - The function containing batched synchronous I/O.
     * @returns {Promise<any>}
     */
    async update(callback) {
        if (this._accessHandle) {
            throw new Error('File is already open for batch update.');
        }

        let fileHandle, accessHandle = null;
        try {
            fileHandle = await this._getHandlePromise();
            accessHandle = await fileHandle.createSyncAccessHandle();
            this._accessHandle = accessHandle;

            return await callback(accessHandle);
        } finally {
            if (accessHandle) {
                accessHandle.close();
            }
            this._accessHandle = null;
            this._clearCache();

            // Notification Logic (update counts as modification)
            if (this.notifier) {
                const bytesH = await this.bytesH;
                this.notifier.fileModified(this.path, bytesH);
            }
        }
    }

    // =========================================================================
    // Properties (Cached Asynchronous Getters)
    // =========================================================================

    /**
     * Gets the size of the file in bytes. Lazy-loaded and cached.
     * @type {Promise<number>}
     */
    get bytes() {
        return this._getOrCache('bytes', async () => {
            if (!await this.exists) return 0;
            const handle = await this._getHandlePromise();
            return withSyncAccessHandle(handle, h => h.getSize());
        });
    }

    /**
     * Gets the size of the file as a human-readable string (e.g., "10.24 KB"). Cached.
     * @type {Promise<string>}
     */
    get bytesH() {
        return this._getOrCache('bytesH', async () => {
            const bytes = await this.bytes;
            return bytesToHumanReadable(bytes);
        });
    }

    /**
     * Checks if the file exists at the path. Lazy-loaded and cached.
     * @type {Promise<boolean>}
     */
    get exists() {
        return this._getOrCache('exists', async () => {
            try {
                await this._getHandlePromise();
                return true;
            } catch (error) {
                return false;
            }
        });
    }

    // Path properties (path, filename, dirname, extension) inherited from BaseOPFSEntity

    /**
     * Returns an initialized OPFSWorkerDirectory instance for the parent directory. Cached.
     * @type {Promise<OPFSWorkerDirectory>}
     */
    get parentDir() {
        return this._getOrCache('parentDir', async () => {
            const dirPath = await this.dirname;
            // Pass the notifier to the parent directory instance
            return new OPFSWorkerDirectory(dirPath, this.notifier);
        });
    }

    /**
     * Gets the derived MIME type based on the file extension. Lazy-loaded and cached.
     * @type {Promise<string>}
     */
    get mimetype() {
        return this._getOrCache('mimetype', async () => getMimeType(await this.extension));
    }

    /**
     * Calculates the SHA-256 hash of the entire file content. Expensive, cached.
     * @type {Promise<string>} Hexadecimal hash string.
     */
    get sha256() {
        return this._getOrCache('sha256', async () => {
            const buffer = await this.readBytes();
            return calculateSHA256(buffer);
        });
    }

    /**
     * Gets the last modified time of the file. Lazy-loaded and cached.
     * @type {Promise<Date>}
     */
    get lastModified() {
        return this._getOrCache('lastModified', async () => {
            const handle = await this._getHandlePromise();
            const file = await handle.getFile();
            return new Date(file.lastModified);
        });
    }

    /**
     * Generates a simple, consistent unique ID for the file. Cached.
     * @type {Promise<string>}
     */
    get uniqueID() {
        return this._getOrCache('uniqueID', async () => {
            const pathBuffer = new TextEncoder().encode(this._path);
            const hashBuffer = await crypto.subtle.digest('SHA-1', pathBuffer);
            return Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0')).slice(0, 4).join('');
        });
    }

    /**
     * Checks if the file is currently locked by a batch 'update' call. Synchronous.
     * @type {boolean}
     */
    get isLocked() {
        return !!this._accessHandle;
    }
}