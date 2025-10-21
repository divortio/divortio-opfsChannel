# ⚡ OPFSWorker: The Web Worker Façade

The `OPFSWorker` class serves as the high-level, synchronous entry point for all Origin Private File System (OPFS) operations from the **Web Worker** context. It uses the Façade pattern, wrapping the high-performance `OPFSWorkerFile` and `OPFSWorkerDirectory` classes.

This class is optimized for **maximum I/O throughput** using the synchronous `FileSystemSyncAccessHandle`. It is essential for low-latency operations in an isolated worker thread. Like its Main Thread counterpart, it manages the single instance of the `OPFSNotifier` for broadcasting file system changes.

---

## Class: `OPFSWorker`

| Property | Type | Description |
| :--- | :--- | :--- |
| `notifier` | `OPFSNotifier` | **(Read-Only)** Provides access to the global notification channel for broadcasting file system events to other contexts. |

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSWorker(agentName?: string | null)` | **Synchronous.** Initializes the façade and creates the single, global `OPFSNotifier` instance. |

---

## Methods (High-Level Asynchronous API)

All methods internally delegate to synchronous I/O operations, meaning the resolved `Promise` executes extremely fast within the worker thread environment.

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `read` | `async read(filePath: string)` | `Promise<Uint8Array>` | Reads the entire content of the file. Resolves after the synchronous disk read. |
| `write` | `async write(filePath: string, data: WriteData, position?: number)` | `Promise<void>` | Writes data to the file using synchronous I/O, automatically creating parent directories. **Notifies** file creation/modification. |
| `hash` | `async hash(filePath: string)` | `Promise<string>` | Calculates the SHA-256 hash of the file content (via in-memory buffer in worker). |
| `list` | `async list(dirPath: string)` | `Promise<EntryInfo[]>` | Lists the names and types of all entries in the specified directory. |
| `makeDir` | `async makeDir(dirPath: string)` | `Promise<void>` | Ensures the specified directory path and all its parents exist. **Notifies** directory creation. |
| `delete` | `async delete(path: string)` | `Promise<void>` | Deletes the specified entity. Recursively deletes directories. **Notifies** file/directory deletion. |
| `copy` | `async copy(sourcePath: string, destPath: string)` | `Promise<OPFSWorkerFile \| OPFSWorkerDirectory>` | Copies a file or recursively copies a directory to the destination. **Notifies** relevant creation events. |
| `move` | `async move(sourcePath: string, destPath: string)` | `Promise<OPFSWorkerFile \| OPFSWorkerDirectory>` | Moves a file or recursively moves a directory. Implemented as copy-then-delete. **Notifies** move event. |
| `exists` | `async exists(path: string)` | `Promise<boolean>` | Checks if an entity exists at the path. |
| `getEntry` | `getEntry(path: string)` | `OPFSWorkerFile \| OPFSWorkerDirectory` | **Factory Method.** Returns a raw `OPFSWorkerFile` or `OPFSWorkerDirectory` instance. Use this for deep access to specialized features (`.update()`, `.toSharedArrayBuffer()`). |