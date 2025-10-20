/**
 * @fileoverview Utility functions for the workerOPFS library, handling low-level OPFS
 * and common data operations.
 */

// --- Typedefs ---
/**
 * @typedef {FileSystemFileHandle} FileHandle
 * @typedef {FileSystemSyncAccessHandle} SyncAccessHandle
 * @typedef {Object} PathInfo
 * @property {string} filename
 * @property {string} dirname
 * @property {string} extension
 */

// --- Exhaustive MIME Type Map ---
/**
 * Exhaustive mapping of common file extensions to MIME types, including codec parameters
 * for common media containers where safe to derive from the extension alone.
 * @private
 * @type {Object<string, string>}
 */
const MIME_MAP = {
    // --- General/Application ---
    'bin': 'application/octet-stream',
    'json': 'application/json',
    'jsonld': 'application/ld+json',
    'xml': 'application/xml',
    'pdf': 'application/pdf',
    'zip': 'application/zip',
    '7z': 'application/x-7z-compressed',
    'rar': 'application/vnd.rar',
    'epub': 'application/epub+zip',
    'jar': 'application/java-archive',
    'exe': 'application/vnd.microsoft.portable-executable',

    // --- Documents ---
    'txt': 'text/plain',
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript', // Use text/javascript for consistency in HTML context
    'mjs': 'text/javascript',
    'csv': 'text/csv',
    'md': 'text/markdown',
    'rtf': 'application/rtf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // --- Images ---
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'tif': 'image/tiff',
    'tiff': 'image/tiff',
    'bmp': 'image/bmp',
    'apng': 'image/apng',
    'avif': 'image/avif',

    // --- Fonts ---
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'woff': 'font/woff',
    'woff2': 'font/woff2',

    // --- Audio/Video (Exhaustive & Codec-Aware) ---
    // MP4 Container (Most common: H.264 + AAC)
    'mp4': 'video/mp4; codecs="avc1.4d002a, mp4a.40.2"',
    'm4v': 'video/mp4; codecs="avc1.4d002a, mp4a.40.2"',
    'm4a': 'audio/mp4; codecs="mp4a.40.2"', // AAC-LC
    'f4v': 'video/mp4', // Flash video in MP4 container (use generic mp4)

    // WebM Container (Royalty-free: VP8/VP9/AV1 + Vorbis/Opus)
    'webm': 'video/webm; codecs="vp8, opus"',
    'weba': 'audio/webm; codecs="opus"',

    // Ogg Container (Royalty-free)
    'ogv': 'video/ogg; codecs="theora, vorbis"',
    'oga': 'audio/ogg; codecs="vorbis"',
    'ogg': 'application/ogg', // Ambiguous, defaults to generic container type
    'opus': 'audio/ogg; codecs="opus"', // Opus is often in Ogg container

    // Transport Streams
    'ts': 'video/mp2t',
    'm2ts': 'video/mp2t',

    // Legacy/Microsoft
    'avi': 'video/x-msvideo',
    'wmv': 'video/x-ms-wmv',
    'wma': 'audio/x-ms-wma',

    // MPEG Audio/Video
    'mpeg': 'video/mpeg',
    'mpg': 'video/mpeg',
    'mp3': 'audio/mpeg',

    // Other Audio
    'aac': 'audio/aac',
    'flac': 'audio/flac', // Native FLAC format
    'wav': 'audio/wav',
    'mid': 'audio/midi',
    'midi': 'audio/midi',

    // 3GPP/Mobile
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',

    // Apple
    'mov': 'video/quicktime',

    // Matroska (Use generic, codecs are too varied to assume)
    'mkv': 'video/x-matroska',
    'mka': 'audio/x-matroska'
};


/**
 * Parses a full file path into its components.
 * @param {string} fullPath
 * @returns {PathInfo}
 */
function parsePath(fullPath) {
    const parts = fullPath.split('/').filter(p => p.length > 0);
    const filename = parts.pop() || '';
    const dirParts = parts.length > 0 ? parts : [];
    const dirname = '/' + dirParts.join('/') + '/';

    const nameParts = filename.split('.');
    // Handles case of '.filename' (dotfiles) by requiring more than one part
    const extension = nameParts.length > 1 ? nameParts.pop() || '' : '';

    return { filename, dirname, extension };
}

/**
 * Retrieves the FileSystemFileHandle, creating parent directories if needed.
 * @param {string} fullPath - The path to the file.
 * @returns {Promise<FileSystemFileHandle>}
 */
async function getFileHandle(fullPath) {
    const { filename, dirname } = parsePath(fullPath);

    if (!filename) {
        throw new Error(`Invalid file path structure: ${fullPath}`);
    }

    let dir = await navigator.storage.getDirectory();

    // Traverse and create directories
    const dirParts = dirname.split('/').filter(p => p.length > 0);
    for (const part of dirParts) {
        dir = await dir.getDirectoryHandle(part, { create: true });
    }

    // Get the file handle (do not create yet)
    return await dir.getFileHandle(filename, { create: false });
}

/**
 * Opens, executes a synchronous I/O callback, and safely closes the access handle.
 * @param {FileSystemFileHandle} fileHandle - The file handle.
 * @param {function(FileSystemSyncAccessHandle): any} callback - The synchronous I/O logic.
 * @returns {Promise<any>}
 */
async function withSyncAccessHandle(fileHandle, callback) {
    let accessHandle = null;
    try {
        accessHandle = await fileHandle.createSyncAccessHandle();

        // Execute the synchronous I/O logic
        return callback(accessHandle);
    } catch (error) {
        // Simple error mapping for clarity
        if (error.name === 'NotFoundError') {
            throw new Error(`OPFS Path not found/invalid handle.`);
        }
        if (error.name === 'NoModificationAllowedError') {
            throw new Error(`OPFS Write failure. Check permissions or handle state.`);
        }
        throw error;
    } finally {
        // CRITICAL: Always close the handle
        if (accessHandle) {
            accessHandle.close();
        }
    }
}

/**
 * Calculates the SHA-256 hash of a Uint8Array.
 * @param {Uint8Array} data - The data to hash.
 * @returns {Promise<string>} Hexadecimal hash string.
 */
async function calculateSHA256(data) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert ArrayBuffer to hex string
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Deletes a file entry from its parent directory.
 * NOTE: This function is now superseded by OPFSWorkerDirectory.deleteFile() but is kept for legacy/utility purposes.
 * @param {string} fullPath - The full path to the file.
 * @returns {Promise<void>}
 */
async function deleteFileEntry(fullPath) {
    const { filename, dirname } = parsePath(fullPath);
    if (!filename) return;

    let dir = await navigator.storage.getDirectory();

    const dirParts = dirname.split('/').filter(p => p.length > 0);

    // Traverse to parent directory
    for (const part of dirParts) {
        dir = await dir.getDirectoryHandle(part);
    }

    await dir.removeEntry(filename);
}

/**
 * Gets the derived MIME type based on the file extension.
 * @param {string} extension - The file extension.
 * @returns {string} The MIME type.
 */
function getMimeType(extension) {
    return MIME_MAP[extension.toLowerCase()] || 'application/octet-stream';
}


/**
 * Converts a byte count into a human-readable string (e.g., 1024 -> "1.02 KB").
 * Uses SI decimal prefixes (kB, MB, GB).
 * @param {number} bytes - The size in bytes.
 * @returns {string} The human-readable file size string.
 */
function bytesToHumanReadable(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1000; // SI standard (Base 10)
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    // Math.floor(Math.log10(bytes)) calculates the exponent (e.g., 10^3 is 3)
    const i = Math.floor(Math.log10(bytes) / 3);

    // ToFixed(2) rounds to two decimal places
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
/**
 * Retrieves a Directory Handle, creating it and its parents if needed.
 * This is the canonical path traversal utility for the main thread.
 * @param {string} fullPath - The path to the directory (must end with '/').
 * @param {boolean} [create=false] - Whether to ensure the directory and its parents exist.
 * @returns {Promise<DirHandle>}
 */
async function getDirHandle(fullPath, create = false) {
    const parts = fullPath.split('/').filter(p => p.length > 0);

    let dir = await navigator.storage.getDirectory();

    for (const part of parts) {
        // Create the directory if requested/needed during traversal
        dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
}


export {
    parsePath,
    getFileHandle,
    withSyncAccessHandle,
    calculateSHA256,
    deleteFileEntry,
    getMimeType,
    getDirHandle,
    bytesToHumanReadable
};