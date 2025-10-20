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

/**
 * @typedef {FileSystemFileHandle} FileHandle
 * @typedef {import('./opfsDir.js').DirHandle} DirHandle
 * @typedef {import('../lib/utils.js').PathInfo} PathInfo
 * @typedef {number} ByteOffset
 * @typedef {string} FilePath
 * @typedef {ArrayBuffer|Uint8Array|ArrayBufferView} WriteData
 */


export class OPFSFile {

    /**
     * Internal Map to cache expensive property results (e.g., bytes, sha256).
     * @private
     * @type {Map<string, any>}
     */
    _cache = new Map();

    /**
     * Promise resolving to the FileSystemFileHandle. Lazy-loaded.
     * @private
     * @type {Promise<FileHandle>|null}
     */
    _fileHandlePromise = null;

    /**
     * The full path to the file (e.g., '/data/image.png').
     * @private
     * @type {FilePath}
     */
    _path = '';

    /**
     * Initializes the OPFSFile instance.
     * @param {FilePath} filePath - The full path to the file.
     */
    constructor(filePath) {
        if (typeof filePath !== 'string' || !filePath) {
            throw new Error('OPFSFile requires a non-empty file path.');
        }
        this._path = filePath;
    }

    // =========================================================================
    // Private Utilities
    // =========================================================================

    /**
     * Clears the property cache for values invalidated by modification or deletion.
     * @private
     */
    _clearCache() {
        this._cache.delete('bytes');
        this._cache.delete('bytesH');
        this._cache.delete('exists');
        this._cache.delete('sha256');
        this._cache.delete('lastModified');
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
        // CRITICAL FIX 2: Get the file object once for slicing
        const file = await fileHandle.getFile();

        // Use slice for partial read
        const end = length !== undefined ? position + length : file.size;

        // Read the blob slice into an ArrayBuffer
        const buffer = await file.slice(position, end).arrayBuffer();

        return new Uint8Array(buffer);
    }

    /**
     * Writes the contents of data to the file using the Writable Stream API.
     * @param {WriteData} data - The data to write (ArrayBuffer, Uint8Array, etc.).
     * @param {ByteOffset} [position=0] - The byte offset to start writing at.
     * @returns {Promise<void>}
     */
    async writeBytes(data, position = 0) {
        // Force creation of file and parent directories if writing to a new path
        const fileHandle = await this._getHandlePromise(true);

        // 1. Get original file size (for accurate truncation check)
        const originalSize = await this.bytes;
        const dataLength = data.byteLength || (data.length * data.BYTES_PER_ELEMENT) || 0;

        // 2. Create the Writable Stream
        const writable = await fileHandle.createWritable();

        try {
            // 3. Write the data
            await writable.write({
                type: 'write',
                data: data,
                position: position
            });

            // CRITICAL FIX 1: Truncate only if the write ended before the original EOF
            const newEnd = position + dataLength;

            if (newEnd < originalSize) {
                await writable.truncate(newEnd);
            }

            // 4. Close the stream to commit changes (CRITICAL)
            await writable.close();

        } catch (error) {
            // Ensure the stream is aborted/closed on failure
            await writable.abort();
            throw error;
        }

        this._clearCache();
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

        this._clearCache();
        const { filename } = parsePath(this._path);

        const parentDir = await this.parentDir;
        await parentDir.deleteFile(filename);

        this._fileHandlePromise = null;
    }

    /**
     * Copies the file to a new path.
     * @param {FilePath} newPath - The destination path.
     * @returns {Promise<OPFSFile>} A new instance representing the copied file.
     */
    async copy(newPath) {
        // Read all content
        const data = await this.readBytes();

        // Write to new location using new OPFSFile instance
        const newFile = new OPFSFile(newPath);
        await newFile.writeBytes(data, 0);
        return newFile;
    }

    /**
     * Moves the file to a new path (implemented as copy then delete).
     * @param {FilePath} newPath - The destination path.
     * @returns {Promise<void>}
     */
    async move(newPath) {
        await this.copy(newPath);
        await this.delete();
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

    /**
     * Gets the full file name with extension. Synchronous (path-derived).
     * @type {string}
     */
    get filename() {
        return parsePath(this._path).filename;
    }

    /**
     * Gets the full file path. Synchronous (constructor input).
     * @type {FilePath}
     */
    get path() {
        return this._path;
    }

    /**
     * Gets the path of the containing directory. Lazy-loaded and cached.
     * @type {Promise<string>}
     */
    get dirname() {
        return this._getOrCache('dirname', async () => parsePath(this._path).dirname);
    }

    /**
     * Returns an initialized OPFSDir instance for the parent directory. Cached.
     * @type {Promise<OPFSDir>}
     */
    get parentDir() {
        return this._getOrCache('parentDir', async () => {
            const dirPath = await this.dirname;
            return new OPFSDir(dirPath);
        });
    }

    /**
     * Gets the file extension only (e.g., 'png'). Lazy-loaded and cached.
     * @type {Promise<string>}
     */
    get extension() {
        return this._getOrCache('extension', async () => parsePath(this._path).extension);
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