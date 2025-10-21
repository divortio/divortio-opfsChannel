# 📄 OPFSFile: Main Thread File Entity

The `OPFSFile` class provides an asynchronous abstraction over a single file entity within the Origin Private File System (OPFS) for the **Main Thread**. It ensures the UI remains responsive by utilizing standard browser asynchronous APIs (e.g., `createWritable()`, `File.slice()`).

This class is typically accessed via the factory method `OPFSMain.getEntry()`.

**Source Code:** [`../../main/opfsFile.js`](../../main/opfsFile.js)

---

## Class: `OPFSFile`

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSFile(filePath: string, notifier?: OPFSNotifier)` | **Synchronous.** Initializes the object. Accepts an optional `OPFSNotifier` instance, usually injected by the calling façade. |

---

## Methods (Asynchronous File I/O)

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `readBytes` | `async readBytes(position?: number, length?: number)` | `Promise<Uint8Array>` | Reads a segment or the entire file content. Throws if the file does not exist. |
| `writeBytes` | `async writeBytes(data: WriteData, position?: number)` | `Promise<void>` | Writes data to the file. Creates parent directories and the file if needed. Truncates if new content is shorter than existing file. **Emits** `file_created` or `file_modified` events. |
| `toBlobURL` | `async toBlobURL(mimeType?: string)` | `Promise<string>` | Reads file content and returns a revocable `blob:` URL for immediate use (e.g., in `<img>` tags). |
| `fromBlobURL` | `async fromBlobURL(url: string)` | `Promise<void>` | Fetches data from a URL or `blob:` URL and writes it, overwriting content from position 0. |
| `delete` | `async delete()` | `Promise<void>` | Deletes the file by delegating the `removeEntry` call to its parent directory. **Emits** `file_deleted` event. |
| `copy` | `async copy(newPath: string)` | `Promise<OPFSFile>` | Copies the file to a new path. Returns the new `OPFSFile` instance. |
| `move` | `async move(newPath: string)` | `Promise<void>` | Moves the file (copy-then-delete). **Emits** `entry_moved` event. |
| `allocate` | `async allocate(size: number)` | `Promise<void>` | Pre-allocates or truncates the file size using the writable stream. **Emits** `file_modified` event. |

---

## Properties (Cached Asynchronous Getters)

These properties trigger asynchronous I/O on first access and retrieve results instantaneously from the cache thereafter. File modification methods (`writeBytes`, `delete`, etc.) clear the cache.

| Property | Type | Cache Status | Description |
| :--- | :--- | :--- | :--- |
| `path` | `string` | No (Synchronous) | The full path to the file. |
| `filename` | `string` | No (Synchronous) | The file name with extension. |
| `exists` | `Promise<boolean>` | Yes | `true` if the file exists on OPFS. |
| `bytes` | `Promise<number>` | Yes | The size of the file in bytes. |
| `bytesH` | `Promise<string>` | Yes | The file size in human-readable format (e.g., "10.24 KB"). |
| `sha256` | `Promise<string>` | Yes | The SHA-256 hash of the entire file content. Uses **streaming** for large file safety. |
| `lastModified` | `Promise<Date>` | Yes | The last modification date and time. |
| `parentDir` | `Promise<OPFSDir>` | Yes | An initialized `OPFSDir` instance for the parent directory. |
| *Inherited* | *See* | *See* | See also: [`BaseOPFSEntity.md`](./BaseOPFSEntity.md) |