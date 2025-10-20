
# 📂 OPFSWorkerDirectory 

The `OPFSWorkerDirectory` class provides a high-performance, asynchronous abstraction layer for managing directories and their contents within the **Web Worker's Origin Private File System (OPFS)**. All I/O operations are lazily executed and use built-in synchronous OPFS APIs for optimal speed.

-----

## Class: `OPFSWorkerDirectory`

| Property | Type | Description |
| :--- | :--- | :--- |
| `directoryPath` | `string` | The full, normalized path of the directory (e.g., `/cache/images/`). |

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSWorkerDirectory(directoryPath)` | **Synchronous.** Initializes the object. No file system access occurs until a method or property is called. |

### Example Usage

```javascript
import {OPFSWorkerDirectory} from './OPFSWorkerDir.md';

// Initialize a directory object
const cacheDir = new OPFSWorkerDirectory('/user/data/cache/');

// Use the object lazily
if (await cacheDir.exists) {
    console.log(`Directory contains ${await cacheDir.count} items.`);
}
```

-----

## Methods (Operations)

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `createFile` | `createFile(filename: string)` | `OPFSWorkerFile` | **Synchronous & Lazy.** Creates and returns an uninitialized `OPFSWorkerFile` object representing a file in this directory. |
| `createDir` | `createDir(dirname: string)` | `OPFSWorkerDirectory` | **Synchronous & Lazy.** Creates and returns an uninitialized `OPFSWorkerDirectory` object representing a subdirectory. |
| `getFile` | `async getFile(name: string)` | `Promise<OPFSWorkerFile \| null>` | Retrieves a file entry by name. Returns `null` if the file doesn't exist. |
| `getDir` | `async getDir(name: string)` | `Promise<OPFSWorkerDirectory \| null>` | Retrieves a subdirectory by name. Returns `null` if the directory doesn't exist. |
| `deleteFile` | `async deleteFile(name: string, recursive?: boolean)` | `Promise<void>` | Deletes the named file or directory. `recursive: true` is required for non-empty directories. Clears the property cache (`count`, `files`, etc.). |
| `moveFile` | `async moveFile(name: string, newPath: string)` | `Promise<void>` | Moves a file from this directory to a new path (implemented as copy-then-delete). **NOTE:** Currently only supports files. |
| `listFiles` | `async listFiles()` | `Promise<Array<{name: string, kind: 'file'\|'directory'}>>` | Fetches the list of all files and subdirectories within this directory. The result is cached. |

### Method Examples

```javascript
// 1. Create a file lazily and then write to it (I/O occurs on .writeBytes)
const newFile = cacheDir.createFile('config.json');
await newFile.writeBytes(new TextEncoder().encode('{"version": 1}'));

// 2. Retrieve and check file type
const result = await cacheDir.getFile('image.jpg');
if (result) {
    console.log(`File MIME type: ${await result.mimetype}`);
}

// 3. Deleting a directory
const archives = cacheDir.getDir('old_logs');
// Deletes the directory and all its contents
await cacheDir.deleteFile('old_logs', true); 
```

-----

## Properties (Asynchronous Getters)

All properties are implemented as `async` getters, meaning they behave like standard properties (`dir.count`) but trigger an asynchronous operation and **cache the result** on first access.

| Property | Type | Description | Cache Status |
| :--- | :--- | :--- | :--- |
| `path` | `string` | The full path of the directory (e.g., `/data/cache/`). | No (Synchronous) |
| `dirname` | `string` | The name of the directory itself (e.g., `cache/`). | No (Synchronous) |
| `parent` | `Promise<OPFSWorkerDirectory>` | An initialized instance representing the parent directory. | Yes |
| `exists` | `Promise<boolean>` | `true` if the directory physically exists on OPFS. | Yes |
| `count` | `Promise<number>` | The total number of entries (files + directories) in this directory. | Yes |
| `isEmpty` | `Promise<boolean>` | `true` if `count` is 0. | Yes |

### Property Examples

```javascript
// Check existence and cache result instantly
if (await cacheDir.exists) {
    // Second access is instant (cached)
    const count = await cacheDir.count; 
    
    // Parent is a cached instance (lazy)
    const rootDir = await cacheDir.parent;
    console.log(`Parent path: ${rootDir.path}`);
}
```