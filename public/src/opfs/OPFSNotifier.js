/**
 * @fileoverview Defines the OPFSNotifier class, a specialized BaseChannel for
 * broadcasting discrete file system events to all interested contexts (tabs/workers).
 */
import { BaseChannel } from '../msgChannels/channels/base.js';
import { BaseMessage } from '../msgChannels/messages/base.js';

/**
 * @typedef {string} FilePath
 * @typedef {string} BytesH
 * @callback OPFSNotificationCallback
 * @param {BaseMessage} message - The structured event message received.
 * @returns {void}
 */

export class OPFSNotifier extends BaseChannel {

    /**
     * The unique name used for file system modification notifications.
     * Renamed to 'opfs' for simplicity.
     * @type {string}
     */
    static CHANNEL_NAME = 'opfs';

    /**
     * Initializes the OPFSNotifier instance.
     * @param {string|null} [agentName=null] - Optional name for this context (e.g., 'UI').
     */
    constructor(agentName = null) {
        // The second parameter is the channelName, which must be unique and constant
        super(OPFSNotifier.CHANNEL_NAME, agentName);
    }

    // =========================================================================
    // Emitters (Internal/Producer API)
    // =========================================================================

    /**
     * Broadcasts that a file was created or overwritten.
     * @param {FilePath} path - The path of the file.
     * @param {BytesH} bytesH - The human-readable size of the file.
     */
    fileCreated(path, bytesH) {
        this.event('file_created', { path, bytesH });
    }

    /**
     * Broadcasts that a file's contents were modified (written to).
     * @param {FilePath} path - The path of the file.
     * @param {BytesH} bytesH - The human-readable size of the file.
     */
    fileModified(path, bytesH) {
        this.event('file_modified', { path, bytesH });
    }

    /**
     * Broadcasts that a file was deleted.
     * @param {FilePath} path - The path of the deleted file.
     */
    fileDeleted(path) {
        this.event('file_deleted', { path });
    }

    /**
     * Broadcasts that a directory was created.
     * @param {FilePath} path - The path of the directory.
     */
    dirCreated(path) {
        this.event('dir_created', { path });
    }

    /**
     * Broadcasts that a directory was deleted.
     * @param {FilePath} path - The path of the deleted directory.
     */
    dirDeleted(path) {
        this.event('dir_deleted', { path });
    }

    /**
     * Broadcasts that an entity (file or directory) was moved.
     * @param {FilePath} oldPath - The original path.
     * @param {FilePath} newPath - The new path.
     * @param {'file'|'directory'} kind - The type of entity moved.
     */
    entryMoved(oldPath, newPath, kind) {
        this.event('entry_moved', { oldPath, newPath, kind });
    }


    // =========================================================================
    // Listeners (Consumer API)
    // =========================================================================

    /**
     * Registers a listener for file creation events.
     * @param {OPFSNotificationCallback} callback
     */
    onFileCreated(callback) {
        this.on('file_created', callback);
    }

    /**
     * Registers a listener for file modification events.
     * @param {OPFSNotificationCallback} callback
     */
    onFileModified(callback) {
        this.on('file_modified', callback);
    }

    /**
     * Registers a listener for file deletion events.
     * @param {OPFSNotificationCallback} callback
     */
    onFileDeleted(callback) {
        this.on('file_deleted', callback);
    }

    /**
     * Registers a listener for directory creation events.
     * @param {OPFSNotificationCallback} callback
     */
    onDirCreated(callback) {
        this.on('dir_created', callback);
    }

    /**
     * Registers a listener for directory deletion events.
     * @param {OPFSNotificationCallback} callback
     */
    onDirDeleted(callback) {
        this.on('dir_deleted', callback);
    }

    /**
     * Registers a listener for entity movement events.
     * @param {OPFSNotificationCallback} callback
     */
    onEntryMoved(callback) {
        this.on('entry_moved', callback);
    }

    /**
     * Registers a listener for ALL file system events.
     * Note: This listens for all defined OPFS events explicitly.
     * @param {OPFSNotificationCallback} callback
     */
    onAnyChange(callback) {
        this.onFileCreated(callback);
        this.onFileModified(callback);
        this.onFileDeleted(callback);
        this.onDirCreated(callback);
        this.onDirDeleted(callback);
        this.onEntryMoved(callback);
    }
}