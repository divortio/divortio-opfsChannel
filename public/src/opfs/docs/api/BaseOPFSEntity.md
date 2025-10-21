# 🏛️ BaseOPFSEntity: Core Entity Abstraction

The `BaseOPFSEntity` class is the fundamental shared base for all four OPFS entity classes ([OPFSFile.md](./OPFSFile.md), [OPFSDir.md](./OPFSDir.md), [OPFSWorkerFile.md](./OPFSWorkerFile.md), [OPFSWorkerDir.md](./OPFSWorkerDir.md)). It encapsulates the **path parsing**, **caching logic**, and **notifier injection** that is identical across both the Main Thread and Web Worker environments, ensuring a DRY codebase.

**Source Code:** [`../../lib/baseOPFS.js`](../../lib/baseOPFS.js)

---

## Class: `BaseOPFSEntity`

### Constructor

| Signature | Description |
| :--- | :--- |
| `new BaseOPFSEntity(path: string, isDirectory: boolean, notifier?: OPFSNotifier)` | **Synchronous.** Performs initial path validation and normalization (ensures directories end with `/`). Accepts the optional event notifier. |

### Protected Methods

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `_clearCache` | `_clearCache()` | `void` | Clears the internal property cache (`_cache`). Called automatically by all entity-modifying methods (e.g., `writeBytes`, `delete`). |
| `_getOrCache` | `async _getOrCache(key: string, generatorFn: () => Promise<any>)` | `Promise<any>` | The core **caching primitive**. Returns the cached value if present; otherwise, executes `generatorFn`, stores the result, and returns it. |

---

## Properties (Synchronous Path Getters)

These properties are derived purely from the path string, involve no I/O, and are instantly available on all entity instances.

| Property | Type | Description |
| :--- | :--- | :--- |
| `path` | `string` | The full, normalized path of the entity (e.g., `/data/file.txt`). |
| `filename` | `string` | The name of the entity, including the extension (for files) or the directory name segment. |
| `dirname` | `string` | The path of the containing directory (e.g., `/data/`). |
| `extension` | `string` | The file extension only (e.g., `'txt'`). Returns `''` for directories. |
| `notifier` | `OPFSNotifier \| null` | The injected notification channel instance. See also: [`OPFSNotifier.md`](./OPFSNotifier.md). |