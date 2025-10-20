
# 📄 OPFSFile 

The `OPFSFile` class provides a user-friendly, asynchronous abstraction layer for managing individual files within the **Main Thread's Origin Private File System (OPFS)**. It uses standard asynchronous APIs (`.getFile()`, `.createWritable()`) and implements property caching for efficient metadata access.

-----

## Class: `OPFSFile`

| Property | Type | Description |
| :--- | :--- | :--- |
| `filePath` | `string` | The full path to the file (e.g., `/user/profile.bin`). |

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSFile(filePath)` | **Synchronous.** Initializes the object. **No file system I/O** is performed until a method or property is accessed, ensuring instant object creation. |

### Example Usage

```javascript
import {OPFSFile} from './index.js'; // Assuming import from main file

const settingsFile = new OPFSFile('/config/settings.json');

// Check existence and read content asynchronously
if (await settingsFile.exists) {
    const data = await settingsFile.readBytes();
    console.log(`File type: ${await settingsFile.mimetype}`);
}
```

-----

## Methods (Asynchronous Operations)

All file content modification methods utilize the asynchronous **Writable Stream API** (`.createWritable()`) and require the stream to be explicitly closed (`.close()`) to commit changes.

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `readBytes` | `async readBytes(position?: number, length?: number)` | `Promise<Uint8Array>` | Reads a segment or the entire file content. Uses `File.slice()` and `File.arrayBuffer()`. |
| `writeBytes` | `async writeBytes(data: Uint8Array, position?: number)` | `Promise<void>` | Writes data to the file using a Writable Stream. Handles truncation if writing less data than the existing file size. |
| `toBlobURL` | `async toBlobURL(mimeType?: string)` | `Promise<string>` | Reads the file and returns a revocable **Object URL** (`blob:`) for main thread usage. |
| `fromBlobURL` | `async fromBlobURL(url: string)` | `Promise<void>` | Fetches data from a Blob or standard URL and writes the content to the file. |
| `delete` | `async delete()` | `Promise<void>` | Deletes the file, delegating the `removeEntry` call to the parent directory (`OPFSDir`). |
| `move` | `async move(newPath: string)` | `Promise<void>` | Moves the file to a new path (copy-then-delete). |
| `copy` | `async copy(newPath: string)` | `Promise<OPFSFile>` | Copies the file to a new path. Returns a new `OPFSFile` instance for the copy. |
| `allocate` | `async allocate(size: number)` | `Promise<void>` | Pre-allocates or truncates the file size using the Writable Stream's `.truncate()` method. |

### Method Examples

```javascript
// 1. Overwriting a large file
const buffer = new Uint8Array(10 * 1024 * 1024); // 10MB
await settingsFile.writeBytes(buffer, 0); 

// 2. Creating a Blob URL to display an image in an <img> tag
const imageUrl = await settingsFile.toBlobURL('image/jpeg');
document.getElementById('img-preview').src = imageUrl; 
```

-----

## Properties (Cached Asynchronous Getters)

All properties are implemented as `async` getters, triggering asynchronous file system metadata lookups only on the **first access**. Results are stored in an internal cache for subsequent, instantaneous retrieval.

| Property | Type | Description | Cache Status |
| :--- | :--- | :--- | :--- |
| `path` | `string` | The full path to the file. | No (Synchronous) |
| `filename` | `string` | The file name with extension. | No (Synchronous) |
| `exists` | `Promise<boolean>` | `true` if the file exists on OPFS. | Yes |
| `bytes` | `Promise<number>` | The size of the file in bytes. | Yes |
| `bytesH` | `Promise<string>` | The file size in human-readable format (e.g., `10.24 KB`). | Yes |
| `dirname` | `Promise<string>` | The path of the containing directory. | Yes |
| `extension` | `Promise<string>` | The file extension only. | Yes |
| `mimetype` | `Promise<string>` | The derived MIME type (codec-aware for media). | Yes |
| `lastModified` | `Promise<Date>` | The last modification date and time. | Yes |
| `uniqueID` | `Promise<string>` | A consistent hash derived from the file path. | Yes |
| `sha256` | `Promise<string>` | The SHA-256 hash of the entire file content. (Expensive, but cached). | Yes |
| `parentDir` | `Promise<OPFSDir>` | An initialized `OPFSDir` instance representing the parent directory. | Yes |

### Property Examples

```javascript
// Check all metadata once, then use freely
if (await settingsFile.exists) {
    const hash = await settingsFile.sha256; 
    const time = await settingsFile.lastModified;
    
    // Subsequent property access is fast (cached)
    console.log(`Hash: ${hash.substring(0, 10)}...`); 
}
```