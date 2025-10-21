# ⚙️ Utils: Standalone Helper Functions

The functions in `opfs/lib/utils.js` are pure utility functions used across the OPFS entity classes for low-level tasks such as path normalization, data hashing, MIME type mapping, and unit conversion. They contain no class state and are thread-safe.

**Source Code:** [`../../lib/utils.js`](../../lib/utils.js)

---

## Functions (Pure Utilities)

| Function | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| `parsePath` | `parsePath(fullPath: string)` | `PathInfo` | Breaks down a full path into `{filename, dirname, extension}` components. |
| `getMimeType` | `getMimeType(extension: string)` | `string` | Maps a file extension to its standardized MIME type (e.g., `'png'` to `'image/png'`). Includes specialized codec-aware types for media containers. |
| `bytesToHumanReadable` | `bytesToHumanReadable(bytes: number)` | `string` | Converts a byte count into a human-readable string using SI decimal prefixes (e.g., `1048576` -> `'1.05 MB'`). |
| `calculateSHA256` | `async calculateSHA256(data: Uint8Array)` | `Promise<string>` | Calculates the SHA-256 hash of a `Uint8Array` buffer. **Used by the synchronous Worker implementation only.** |
| `withSyncAccessHandle` | `async withSyncAccessHandle(handle: FileHandle, callback: (handle: SyncAccessHandle) => any)` | `Promise<any>` | Crucial wrapper function. Opens a `FileSystemSyncAccessHandle`, executes the synchronous `callback`, and guarantees the handle is safely closed (`handle.close()`) in a `finally` block. |
| `getDirHandle` | `async getDirHandle(fullPath: string, create?: boolean)` | `Promise<DirHandle>` | Main thread utility that retrieves a Directory Handle, creating parent directories during traversal if `create` is true. |

