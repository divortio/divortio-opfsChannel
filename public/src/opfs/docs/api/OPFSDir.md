# 📂 OPFSDir: Main Thread Directory Entity

The `OPFSDir` class provides an asynchronous abstraction for managing a directory within the Origin Private File System (OPFS) for the **Main Thread**. It utilizes asynchronous traversal and ensures the UI remains unblocked.

This class is typically accessed via the factory method `OPFSMain.getEntry()`.

**Source Code:** [`../../main/opfsDir.js`](../../main/opfsDir.js)

---

## Class: `OPFSDir`

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSDir(directoryPath: string, notifier?: OPFSNotifier)` | **Synchronous.** Initializes the object. Ensures the path ends with a slash. Accepts an optional `OPFSNotifier` instance. |

### Private Methods

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `_getHandlePromise` | `async _getHandlePromise(create?: boolean)` | `Promise<DirHandle>` | Retrieves the directory handle. If `create` is true and the directory did not exist, **emits** `dir_created`. |
| `_copyDirRecursive` | `async _copyDirRecursive(newPath: string)` | `Promise<void>` | Internal recursive traversal and copying logic used by `copyDir`. |

---

## Methods (Asynchronous Directory Operations)

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `createFile` | `createFile(filename: string)` | `OPFSFile` | **Synchronous & Lazy.** Returns a new, uninitialized file object in this directory. |
| `createDir` | `createDir(dirname: string)` | `OPFSDir` | **Synchronous & Lazy.** Returns a new, uninitialized directory object in this directory. |
| `getFile` | `async getFile(name: string)` | `Promise<OPFSFile \| null>` | Attempts to retrieve a file entry by name. |
| `getDir` | `async getDir(name: string)` | `Promise<OPFSDir \| null>` | Attempts to retrieve a subdirectory entry by name. |
| `listFiles` | `async listFiles()` | `Promise<EntryInfo[]>` | Lists the names and types of all files and directories in this directory. Cached. |
| `deleteFile` | `async deleteFile(name: string, recursive?: boolean)` | `Promise<void>` | Deletes a file or directory by name. **Emits** `file_deleted` or `dir_deleted`. |
| `deleteDir` | `async deleteDir(name: string)` | `Promise<void>` | Deletes a directory and all its contents recursively (`deleteFile(name, true)`). **Emits** `dir_deleted`. |
| `copyDir` | `async copyDir(newPath: string)` | `Promise<OPFSDir>` | Recursively copies this directory and its contents to a new destination. |
| `moveDir` | `async moveDir(newPath: string)` | `Promise<OPFSDir>` | Recursively moves this directory (copy-then-delete). **Emits** `entry_moved`. |

---

## Properties (Cached Asynchronous Getters)

| Property | Type | Cache Status | Description |
| :--- | :--- | :--- | :--- |
| `path` | `string` | No (Synchronous) | The full path to the directory (ends with `/`). |
| `exists` | `Promise<boolean>` | Yes | `true` if the directory exists on OPFS. |
| `count` | `Promise<number>` | Yes | The total number of entries (files + directories) in this directory. |
| `isEmpty` | `Promise<boolean>` | Yes | `true` if the directory contains no entries. |
| `parent` | `Promise<OPFSDir>` | Yes | An initialized `OPFSDir` instance representing the parent directory. |
| *Inherited* | *See* | *See* | See also: [`BaseOPFSEntity.md`](./BaseOPFSEntity.md) |