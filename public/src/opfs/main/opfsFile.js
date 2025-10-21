/**
 * @fileoverview The OPFSFile class, a main thread-exclusive abstraction over the
 * Origin Private File System (OPFS) using ASYNCHRONOUS APIs.
 */
import {
    parsePath,
    getMimeType,
    calculateSHA256,
    bytesToHumanReadable
} from '../lib/utils.js';

import { OPFSDir } from './opfsDir.js';
import { BaseOPFSEntity } from '../lib/baseOPFS.js'; // <-- Dependency on BaseOPFSEntity

/**
 * @typedef {FileSystemFileHandle} FileHandle
 * @typedef {import('./opfsDir.js').DirHandle} DirHandle
 * @typedef {import('../lib/utils.js').PathInfo} PathInfo
 * @typedef {number} ByteOffset
 * @typedef {string} FilePath
 * @typedef {ArrayBuffer|Uint8Array|ArrayBufferView} WriteData
 * @typedef {import('../OPFSNotifier.js').OPFSNotifier} OPFSNotifier
 */


export class OPFSFile extends BaseOPFSEntity {

    /**
     * Promise resolving to the FileSystemFileHandle. Lazy-loaded.
     * @private
     * @type {Promise<FileHandle>|null}
     */
    _fileHandlePromise = null;

    /**
     * Initializes the OPFSFile instance.
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
     * Delegates to OPFSDir to ensure parent path exists and handles file creation.
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

                // 1. Get the parent directory handle, creating structure if requested
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
    // Methods (Asynchronous I/O Operations)
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

        const fileHandle = await this._getHandlePromise();
        const file = await fileHandle.getFile();

        // Use slice for partial read
        const end = length !== undefined ? position + length : file.size;

        // Read the blob slice into an ArrayBuffer
        const buffer = await file.slice(position, end).arrayBuffer();

        return new Uint8Array(buffer);
    }

    /**
     * Writes the contents of data to the file using the Writable Stream API.
     * NOTE: This method implicitly creates parent directories if they do not exist.
     * @param {WriteData} data - The data to write (ArrayBuffer, Uint8Array, etc.).
     * @param {ByteOffset} [position=0] - The byte offset to start writing at.
     * @returns {Promise<void>}
     */
    async writeBytes(data, position = 0) {
        const fileExisted = await this.exists;

        // Force creation of file and parent directories if writing to a new path
        const fileHandle = await this._getHandlePromise(true);

        const originalSize = await this.bytes;
        const dataLength = data.byteLength || (data.length * data.BYTES_PER_ELEMENT) || 0;

        const writable = await fileHandle.createWritable();

        try {
            await writable.write({
                type: 'write',
                data: data,
                position: position
            });

            const newEnd = position + dataLength;

            if (newEnd < originalSize) {
                await writable.truncate(newEnd);
            }

            await writable.close();

        } catch (error) {
            await writable.abort();
            throw error;
        }

        this._clearCache();

        // Notification Logic
        if (this.notifier) {
            const bytesH = await this.bytesH;
            if (!fileExisted) {
                this.notifier.fileCreated(this.path, bytesH);
            } else {
                this.notifier.fileModified(this.path, bytesH); // Modification includes overwrite/append
            }
        }
    }

    /**
     * Creates an Object URL (Blob URL) for the file content.
     * @param {string} [mimeType] - Optional MIME type for the Blob. Defaults to derived type.
     * @returns {Promise<string>} The Blob URL.
     */
    async toBlobURL(mimeType) {
        if (!await this.exists) {
            throw new Error(`Cannot create Blob URL: File does not exist at ${this._path}.`);
        }

        const fileHandle = await this._getHandlePromise();
        const file = await fileHandle.getFile();

        // Use the File object directly as a Blob
        const type = mimeType || await this.mimetype;
        const blob = new Blob([file], { type });

        return URL.createObjectURL(blob);
    }

    /**
     * Fetches data from a Blob URL or standard URL and writes it to the file.
     * NOTE: This operation implicitly creates parent directories for the destination path.
     * @param {string} url - The Blob URL or standard URL.
     * @returns {Promise<void>}
     */
    async fromBlobURL(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data from URL: ${response.statusText}`);
        }
        // Get data as an ArrayBuffer and write it
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
            throw new Error('Cannot delete the root directory.');
        }

        const deletedPath = this.path;

        this._clearCache();
        const { filename } = parsePath(this._path);

        const parentDir = await this.parentDir;
        await parentDir.deleteFile(filename);

        this._fileHandlePromise = null;

        // Notification Logic
        if (this.notifier) {
            this.notifier.fileDeleted(deletedPath);
        }
    }

    /**
     * Copies the file to a new path.
     * NOTE: This operation implicitly creates parent directories for the destination path.
     * @param {FilePath} newPath - The destination path.
     * @returns {Promise<OPFSFile>} A new instance representing the copied file.
     */
    async copy(newPath) {
        // Read all content
        const data = await this.readBytes();

        // Pass notifier to the new file instance
        const newFile = new OPFSFile(newPath, this.notifier);
        await newFile.writeBytes(data, 0); // writeBytes handles creation/modification notification
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
     * Pre-allocates or truncates disk space for the file.
     * @param {number} size - The target size in bytes.
     * @returns {Promise<void>}
     */
    async allocate(size) {
        if (typeof size !== 'number' || size < 0) {
            throw new TypeError('Size must be a non-negative number.');
        }
        const fileHandle = await this._getHandlePromise(true);

        const writable = await fileHandle.createWritable();
        try {
            await writable.truncate(size);
            await writable.close();
        } catch (error) {
            await writable.abort();
            throw error;
        }

        this._clearCache();

        // Notification Logic: Allocation is a file modification
        if (this.notifier) {
            const bytesH = await this.bytesH;
            this.notifier.fileModified(this.path, bytesH);
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
            const fileHandle = await this._getHandlePromise();
            // Get size from the File object
            return (await fileHandle.getFile()).size;
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
                await this._getHandlePromise(false);
                return true;
            } catch (error) {
                return false;
            }
        });
    }

    // Path properties (path, filename, dirname, extension) inherited from BaseOPFSEntity

    /**
     * Returns an initialized OPFSDir instance for the parent directory. Cached.
     * @type {Promise<OPFSDir>}
     */
    get parentDir() {
        return this._getOrCache('parentDir', async () => {
            const dirPath = await this.dirname;
            // Pass the notifier to the parent directory instance
            return new OPFSDir(dirPath, this.notifier);
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
     * Calculates the SHA-256 hash of the entire file content using the streaming
     * Web Crypto API to ensure memory efficiency for large files.
     * @type {Promise<string>} Hexadecimal hash string.
     */
    get sha256() {
        return this._getOrCache('sha256', async () => {
            if (!await this.exists) return '';

            // 1. Get File Handle and File object
            const fileHandle = await this._getHandlePromise();
            const file = await fileHandle.getFile();

            // 2. Use streaming for memory efficiency
            const hashBuffer = await crypto.subtle.digest('SHA-256', file.stream());

            // Convert ArrayBuffer to hex string
            return Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        });
    }

    /**
     * Gets the last modified time of the file. Lazy-loaded and cached.
     * @type {Promise<Date>}
     */
    get lastModified() {
        return this._getOrCache('lastModified', async () => {
            if (!await this.exists) return null;
            const fileHandle = await this._getHandlePromise();
            return new Date((await fileHandle.getFile()).lastModified);
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
}