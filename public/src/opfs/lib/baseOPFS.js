/**
 * @fileoverview Defines the BaseOPFSEntity class, a foundational class for both
 * OPFSFile and OPFSDir abstractions, managing caching and common path properties.
 */
import { parsePath } from './utils.js';

/**
 * @typedef {string} FilePath
 * @typedef {import('../OPFSNotifier.js').OPFSNotifier} OPFSNotifier
 */

export class BaseOPFSEntity {
    /**
     * Internal Map to cache expensive property results (e.g., bytes, sha256).
     * @private
     * @type {Map<string, any>}
     */
    _cache = new Map();

    /**
     * The full path to the entity.
     * @private
     * @type {FilePath}
     */
    _path = '';

    /**
     * The injected OPFSNotifier instance used to broadcast file system changes.
     * @private
     * @type {OPFSNotifier|null}
     */
    _notifier = null;

    /**
     * Initializes the BaseOPFSEntity. Handles path validation and assignment.
     * @param {FilePath} path - The full path to the entity.
     * @param {boolean} isDirectory - True if the path represents a directory (requires trailing slash normalization).
     * @param {OPFSNotifier|null} [notifier=null] - The injected OPFSNotifier instance.
     */
    constructor(path, isDirectory, notifier = null) {
        if (typeof path !== 'string' || !path) {
            throw new Error('OPFS entity requires a non-empty path.');
        }

        if (isDirectory) {
            // Normalize path to ensure it ends with a slash, unless it's the root.
            this._path = path.endsWith('/') ? path : path + '/';
        } else {
            this._path = path;
        }

        this._notifier = notifier; // Assign the injected notifier
    }

    // =========================================================================
    // Cache Management
    // =========================================================================

    /**
     * Clears the property cache for values invalidated by modification or deletion.
     * @protected
     */
    _clearCache() {
        // Clear all common cache keys used by file and directory classes.
        this._cache.clear();
    }

    /**
     * Retrieves the cached value for a key, or computes and caches it using a generator function.
     * @protected
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

    // =========================================================================
    // Shared Path Properties
    // =========================================================================

    /**
     * Gets the full path. Synchronous.
     * @type {FilePath}
     */
    get path() {
        return this._path;
    }

    /**
     * Gets the entity name with extension (for files) or directory name (for directories). Synchronous (path-derived).
     * @type {string}
     */
    get filename() {
        // Filename is always the last segment of the path, whether it's a file or a directory name.
        return parsePath(this._path).filename;
    }

    /**
     * Gets the path of the containing directory. Synchronous (path-derived).
     * @type {FilePath}
     */
    get dirname() {
        // For files: parsePath provides the dirname (e.g., '/data/')
        return parsePath(this._path).dirname;
    }

    /**
     * Gets the file extension only. Synchronous (path-derived).
     * @type {string}
     */
    get extension() {
        return parsePath(this._path).extension;
    }

    /**
     * Gets the injected notifier instance.
     * @protected
     * @returns {OPFSNotifier|null}
     */
    get notifier() {
        return this._notifier;
    }
}