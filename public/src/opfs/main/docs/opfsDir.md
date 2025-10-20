
# 📂 OPFSDir 

The `OPFSDir` class provides a robust, asynchronous abstraction layer for managing directories and their contents within the **Main Thread's Origin Private File System (OPFS)**. It maintains the lazy execution and caching model of the library while utilizing the main thread's asynchronous OPFS APIs.

-----

## Class: `OPFSDir`

| Property | Type | Description |
| :--- | :--- | :--- |
| `directoryPath` | `string` | The full, normalized path of the directory (e.g., `/cache/images/`). |

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSDir(directoryPath)` | **Synchronous.** Initializes the object. No file system access occurs until a method or property is called, adhering to the lazy model. |

### Example Usage

```javascript
import {OPFSDir} from './index.js'; // Assuming import from main file

// Initialize a directory object
const dataDir = new OPFSDir('/user/data/');

// Use the object lazily
if (await dataDir.exists) {
    console.log(`Directory has ${await dataDir.count} items.`);
}
```

-----

## Methods (Asynchronous Operations)

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `createFile` | `createFile(filename: string)` | `OPFSFile` | **Synchronous & Lazy.** Creates and returns an uninitialized `OPFSFile` object representing a file in this directory. (No I/O). |
| `createDir` | `createDir(dirname: string)` | `OPFSDir` | **Synchronous & Lazy.** Creates and returns an uninitialized `OPFSDir` object representing a subdirectory. (No I/O). |
| `getFile` | `async getFile(name: string)` | `Promise<OPFSFile \| null>` | Attempts to retrieve a file entry by name. Returns `null` if the file doesn't exist or is a directory. |
| `getDir` | `async getDir(name: string)` | `Promise<OPFSDir \| null>` | Attempts to retrieve a subdirectory by name. Returns `null` if the directory doesn't exist or is a file. |
| `deleteFile` | `async deleteFile(name: string, recursive?: boolean)` | `Promise<void>` | Deletes the named file or directory. `recursive: true` is required for non-empty directories. Clears the property cache. |
| `moveFile` | `async moveFile(name: string, newPath: string)` | `Promise<void>` | Moves a file from this directory to a new path (implemented as copy-then-delete). **NOTE:** Currently only supports files. |
| `listFiles` | `async listFiles()` | `Promise<Array<{name: string, kind: 'file'\|'directory'}>>` | Fetches the list of all files and subdirectories using the asynchronous directory iterator. The result is cached. |

### Method Examples

```javascript
// 1. Create a directory lazily, then use it (I/O occurs on .exists)
const logs = dataDir.createDir('logs');
if (!(await logs.exists)) {
    console.log("Logs directory will be created on first I/O call inside it.");
}

// 2. Listing and iteration
const files = await dataDir.listFiles();
for (const entry of files) {
    if (entry.kind === 'file') {
        const file = await dataDir.getFile(entry.name);
        console.log(`Processing file: ${await file.bytesH}`);
    }
}
```

-----

## Properties (Asynchronous Getters)

All properties are implemented as `async` getters, meaning they trigger an asynchronous operation on **first access** and **cache the result** for instantaneous retrieval on subsequent calls.

| Property | Type | Description | Cache Status |
| :--- | :--- | :--- | :--- |
| `path` | `string` | The full path of the directory. | No (Synchronous) |
| `dirname` | `string` | The name of the directory itself (e.g., `data/`). | No (Synchronous) |
| `parent` | `Promise<OPFSDir>` | An initialized instance representing the parent directory. | Yes |
| `exists` | `Promise<boolean>` | `true` if the directory physically exists on OPFS. | Yes |
| `count` | `Promise<number>` | The total number of entries (files + directories) in this directory. | Yes |
| `isEmpty` | `Promise<boolean>` | `true` if the directory contains no entries. | Yes |

### Property Examples

```javascript
// The parent property returns a new OPFSDir instance lazily
const rootDir = await dataDir.parent;

// Accessing the count requires I/O once, then is cached
const fileCount = await dataDir.count; 
const fileCountAgain = await dataDir.count; // Instant return
```