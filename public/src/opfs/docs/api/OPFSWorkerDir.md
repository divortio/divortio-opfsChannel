# 📂 OPFSWorkerDirectory: Worker Thread Directory Entity

The `OPFSWorkerDirectory` class provides a high-performance abstraction for managing a directory within the Origin Private File System (OPFS) for the **Web Worker** context.

This class is typically accessed via the factory method `OPFSWorker.getEntry()`.

**Source Code:** [`../../worker/opfsWorkerDir.js`](../../worker/opfsWorkerDir.js)

---

## Class: `OPFSWorkerDirectory`

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSWorkerDirectory(directoryPath: string, notifier?: OPFSNotifier)` | **Synchronous.** Initializes the object. Accepts an optional `OPFSNotifier` instance. |

---

## Methods (Asynchronous Directory Operations)

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `createFile` | `createFile(filename: string)` | `OPFSWorkerFile` | **Synchronous & Lazy.** Returns a new, uninitialized file object in this directory. |
| `createDir` | `createDir(dirname: string)` | `OPFSWorkerDirectory` | **Synchronous & Lazy.** Returns a new, uninitialized directory object in this directory. |
| `getFile` | `async getFile(name: string)` | `Promise<OPFSWorkerFile \| null>` | Attempts to retrieve a file entry by name. |
| `getDir` | `async getDir(name: string)` | `Promise<OPFSWorkerDirectory \| null>` | Attempts to retrieve a subdirectory entry by name. |
| `listFiles` | `async listFiles()` | `Promise<EntryInfo[]>` | Lists the names and types of all entries in this directory. Cached. |
| `deleteFile` | `async deleteFile(name: string, recursive?: boolean)` | `Promise<void>` | Deletes a file or directory by name. **Emits** `file_deleted` or `dir_deleted`. |
| `deleteDir` | `async deleteDir(name: string)` | `Promise<void>` | Deletes a directory and all its contents recursively. **Emits** `dir_deleted`. |
| `copyDir` | `async copyDir(newPath: string)` | `Promise<OPFSWorkerDirectory>` | Recursively copies this directory and its contents to a new destination. |
| `moveDir` | `async moveDir(newPath: string)` | `Promise<OPFSWorkerDirectory>` | Recursively moves this directory (copy-then-delete). **Emits** `entry_moved`. |

---

## Properties (Cached Asynchronous Getters)

| Property | Type | Cache Status | Description |
| :--- | :--- | :--- | :--- |
| `path` | `string` | No (Synchronous) | The full path to the directory (ends with `/`). |
| `exists` | `Promise<boolean>` | Yes | `true` if the directory exists on OPFS. |
| `count` | `Promise<number>` | Yes | The total number of entries (files + directories) in this directory. |
| `isEmpty` | `Promise<boolean>` | Yes | `true` if the directory contains no entries. |
| `parent` | `Promise<OPFSWorkerDirectory>` | Yes | An initialized `OPFSWorkerDirectory` instance representing the parent directory. |
| *Inherited* | *See* | *See* | See also: [`BaseOPFSEntity.md`](./BaseOPFSEntity.md) |