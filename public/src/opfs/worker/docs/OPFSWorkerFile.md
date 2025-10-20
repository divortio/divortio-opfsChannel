
# 📄 OPFSWorkerFile 

The `OPFSWorkerFile` class is the core abstraction in the `workerOPFS` library, designed for high-performance, low-latency binary I/O on individual files within the **Web Worker's Origin Private File System (OPFS)**. It utilizes the synchronous `FileSystemSyncAccessHandle` for maximum speed and employs comprehensive caching.

-----

## Class: `OPFSWorkerFile`

| Property | Type | Description |
| :--- | :--- | :--- |
| `filePath` | `string` | The full path to the file (e.g., `/user/profile.bin`). |

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSWorkerFile(filePath)` | **Synchronous.** Initializes the object. **No I/O** is performed until a method or property is called, fully adhering to the lazy execution model. |

### Example Usage

```javascript
import {OPFSWorkerFile} from './OPFSWorkerFile.md';

const file = new OPFSWorkerFile('/config/settings.json');

// Defer I/O until needed
if (await file.exists) {
    console.log(`File size is: ${await file.bytesH}`);
} else {
    await file.writeBytes(new TextEncoder().encode('{}'));
}
```

-----

## Methods (Operations)

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `readBytes` | `async readBytes(position?: number, length?: number)` | `Promise<Uint8Array>` | Reads a segment or the entire file content into a new **Uint8Array**. Uses synchronous OPFS I/O internally. |
| `writeBytes` | `async writeBytes(data: Uint8Array, position?: number)` | `Promise<void>` | Writes the given **Uint8Array** data to the file, starting at the specified position. Creates the file and parent directories if they don't exist. |
| `toSharedArrayBuffer` | `async toSharedArrayBuffer()` | `Promise<SharedArrayBuffer>` | Reads the entire file content into a new, transferable **SharedArrayBuffer**. Ideal for low-latency inter-worker communication. |
| `fromSharedArrayBuffer` | `async fromSharedArrayBuffer(sab: SharedArrayBuffer, position?: number)` | `Promise<void>` | Writes the contents of a **SharedArrayBuffer** to the file. |
| `toBlobURL` | `async toBlobURL(mimeType?: string)` | `Promise<string>` | Reads the file, creates a `Blob`, and returns a revocable **Object URL** (`blob:`) for use in the main thread (e.g., for `<img>` or `<video>` sources). |
| `fromBlobURL` | `async fromBlobURL(url: string)` | `Promise<void>` | Fetches data from a Blob URL (using `fetch`) and writes the content to the file. |
| `delete` | `async delete()` | `Promise<void>` | Deletes the file. Delegates the `removeEntry` call to the parent directory instance. |
| `move` | `async move(newPath: string)` | `Promise<void>` | Moves the file to a new path (implemented as `copy` followed by `delete`). |
| `copy` | `async copy(newPath: string)` | `Promise<OPFSWorkerFile>` | Copies the file to a new path. Returns a new `OPFSWorkerFile` instance for the copy. |
| `allocate` | `async allocate(size: number)` | `Promise<void>` | Pre-allocates or truncates the file size to the given `size` using synchronous I/O. Useful for fixed-size files. |
| `update` | `async update(callback: (handle: SyncAccessHandle) => any)` | `Promise<any>` | **High-Performance Batching.** Opens the synchronous access handle once, executes the callback, and ensures safe closure. Use for multiple sequential reads/writes without the open/close overhead. |

### Method Examples

```javascript
// 1. Reading 1MB from the middle of a file
const chunk = await file.readBytes(1048576, 1048576);

// 2. Batch I/O for high speed
await file.update(handle => {
    // These calls are SYNCHRONOUS and non-blocking relative to the handle lifecycle
    handle.write(new Uint8Array(10), { at: 0 });
    handle.truncate(10);
}); 

// 3. Delete
await file.delete(); 
```

-----

## Properties (Cached Asynchronous Getters)

All properties are implemented as `async` getters, triggering an asynchronous file system check only on the **first access**, and then retrieving the result instantly from an internal cache for subsequent calls. File modification methods (`writeBytes`, `delete`, `allocate`) automatically clear this cache.

| Property | Type | Description | Cache Status |
| :--- | :--- | :--- | :--- |
| `path` | `string` | The full path passed to the constructor. | No (Synchronous) |
| `filename` | `string` | The file name with extension (e.g., `image.png`). | No (Synchronous) |
| `isLocked` | `boolean` | `true` if the file is currently locked by a batch `update()` call. | No (Synchronous) |
| `exists` | `Promise<boolean>` | `true` if the file exists on OPFS. | Yes |
| `bytes` | `Promise<number>` | The size of the file in bytes. | Yes |
| `bytesH` | `Promise<string>` | The file size in human-readable format (e.g., `10.24 KB`). | Yes |
| `dirname` | `Promise<string>` | The path of the containing directory (e.g., `/config/`). | Yes |
| `extension` | `Promise<string>` | The file extension only (e.g., `png`). | Yes |
| `mimetype` | `Promise<string>` | The derived MIME type (e.g., `image/png`). Uses an exhaustive, codec-aware internal map. | Yes |
| `lastModified` | `Promise<Date>` | The last modification date and time. | Yes |
| `uniqueID` | `Promise<string>` | A small, consistent hash derived from the path, useful for stable keys. | Yes |
| `parentDir` | `Promise<OPFSWorkerDirectory>` | An initialized `OPFSWorkerDirectory` instance representing the parent directory. | Yes |

### Property Examples

```javascript
// First call triggers I/O, subsequent calls are instant
const hash = await file.sha256; 
console.log(hash); // Output: a3b2...

// Second call is instant (cached)
if (await file.exists) {
    console.log(`Human size: ${await file.bytesH}`); 
}
```