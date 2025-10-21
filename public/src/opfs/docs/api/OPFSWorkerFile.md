# ⚡ OPFSWorkerFile: Worker Thread File Entity

The `OPFSWorkerFile` class provides a high-performance, abstraction over a single file entity within the Origin Private File System (OPFS) for the **Web Worker** context. It uses **synchronous I/O** via `FileSystemSyncAccessHandle` for maximum throughput.

This class is typically accessed via the factory method `OPFSWorker.getEntry()`.

**Source Code:** [`../../worker/opfsWorkerFile.js`](../../worker/opfsWorkerFile.js)

---

## Class: `OPFSWorkerFile`

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSWorkerFile(filePath: string, notifier?: OPFSNotifier)` | **Synchronous.** Initializes the object. Accepts an optional `OPFSNotifier` instance. |

---

## Methods (Synchronous File I/O)

All methods are wrapped in Promises but perform **blocking synchronous disk I/O** within the worker.

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `readBytes` | `async readBytes(position?: number, length?: number)` | `Promise<Uint8Array>` | Reads a segment or the entire file content using synchronous `handle.read()`. |
| `writeBytes` | `async writeBytes(data: Uint8Array, position?: number)` | `Promise<void>` | Writes data using synchronous `handle.write()`. **Emits** `file_created` or `file_modified` events. |
| `toSharedArrayBuffer` | `async toSharedArrayBuffer()` | `Promise<SharedArrayBuffer>` | Reads the entire file content into a new `SharedArrayBuffer` for efficient zero-copy transfer. |
| `fromSharedArrayBuffer` | `async fromSharedArrayBuffer(sab: SharedArrayBuffer, position?: number)` | `Promise<void>` | Writes the contents of a `SharedArrayBuffer` to the file. |
| `update` | `async update(callback: (handle: SyncAccessHandle) => any)` | `Promise<any>` | **Batch I/O Primitive.** Opens the synchronous access handle once, executes the callback, and ensures safe closure, minimizing I/O overhead. **Emits** `file_modified` event upon completion. |
| `delete` | `async delete()` | `Promise<void>` | Deletes the file. **Emits** `file_deleted` event. |
| `copy` | `async copy(newPath: string)` | `Promise<OPFSWorkerFile>` | Copies the file to a new path. |
| `move` | `async move(newPath: string)` | `Promise<void>` | Moves the file (copy-then-delete). **Emits** `entry_moved` event. |

---

## Properties (Cached Asynchronous Getters)

| Property | Type | Cache Status | Description |
| :--- | :--- | :--- | :--- |
| `path` | `string` | No (Synchronous) | The full path to the file. |
| `isLocked` | `boolean` | No (Synchronous) | `true` if the file is currently locked by a batch `.update()` call. |
| `bytes` | `Promise<number>` | Yes | The size of the file in bytes. |
| `bytesH` | `Promise<string>` | Yes | The file size in human-readable format. |
| `sha256` | `Promise<string>` | Yes | The SHA-256 hash of the entire file content. |
| `parentDir` | `Promise<OPFSWorkerDirectory>` | Yes | An initialized `OPFSWorkerDirectory` instance for the parent directory. |
| *Inherited* | *See* | *See* | See also: [`BaseOPFSEntity.md`](./BaseOPFSEntity.md) |