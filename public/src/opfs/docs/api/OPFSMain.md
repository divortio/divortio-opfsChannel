# 🌐 OPFSMain: The Main Thread Façade

The `OPFSMain` class serves as the high-level, asynchronous entry point for all Origin Private File System (OPFS) operations from the **Main Thread**. It employs the Façade pattern, wrapping the specialized `OPFSFile` and `OPFSDir` classes to provide simplified, path-based methods (e.g., `OPFSMain.read('/data/file.bin')`).

This class is designed for UI thread safety, ensuring all underlying I/O operations are handled asynchronously. It also manages the single instance of the `OPFSNotifier` for broadcasting file system changes.

---

## Class: `OPFSMain`

| Property | Type | Description |
| :--- | :--- | :--- |
| `notifier` | `OPFSNotifier` | **(Read-Only)** Provides access to the global notification channel for registering file system event listeners. |

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSMain(agentName?: string | null)` | **Synchronous.** Initializes the façade and creates the single, global `OPFSNotifier` instance. |

---

## Methods (High-Level Asynchronous API)

All methods automatically determine if the operation is on a file or a directory based on the path structure.

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `read` | `async read(filePath: string)` | `Promise<Uint8Array>` | Reads the entire content of the file. **Asynchronously.** |
| `write` | `async write(filePath: string, data: WriteData, position?: number)` | `Promise<void>` | Writes data to the file, automatically creating parent directories. **Notifies** file creation/modification. |
| `hash` | `async hash(filePath: string)` | `Promise<string>` | Calculates the **streaming, memory-safe SHA-256 hash** of the file content. |
| `list` | `async list(dirPath: string)` | `Promise<EntryInfo[]>` | Lists the names and types of all entries in the specified directory. |
| `makeDir` | `async makeDir(dirPath: string)` | `Promise<void>` | Ensures the specified directory path and all its parents exist. **Notifies** directory creation. |
| `delete` | `async delete(path: string)` | `Promise<void>` | Deletes the specified entity. Recursively deletes directories. **Notifies** file/directory deletion. |
| `copy` | `async copy(sourcePath: string, destPath: string)` | `Promise<OPFSFile \| OPFSDir>` | Copies a file or recursively copies a directory to the destination. **Notifies** relevant creation events. |
| `move` | `async move(sourcePath: string, destPath: string)` | `Promise<OPFSFile \| OPFSDir>` | Moves a file or recursively moves a directory. Implemented as copy-then-delete. **Notifies** move event. |
| `exists` | `async exists(path: string)` | `Promise<boolean>` | Checks if an entity exists at the path. |
| `getEntry` | `getEntry(path: string)` | `OPFSFile \| OPFSDir` | **Factory Method.** Returns a raw `OPFSFile` or `OPFSDir` instance tied to the path. Use this for deep access to cached properties (`.bytesH`, `.lastModified`) or entity-specific methods. |