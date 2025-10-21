# 🔔 OPFSNotifier: File System Event Broadcast Channel

The `OPFSNotifier` class provides a simple, event-driven mechanism for broadcasting and listening to file system changes across all interconnected contexts (Main Thread, Web Workers, and other browser tabs/windows). It extends the underlying [BaseChannel](../msgChannels/channels/base.js) and abstracts the message complexity into simple, semantic function calls.

This class is instantiated once by the [`OPFSMain.md`](./OPFSMain.md) and [`OPFSWorker.md`](./OPFSWorker.md) Façades and injected into all file/directory entities for automatic event emission upon modification.

**Source Code:** [`../../OPFSNotifier.js`](../../OPFSNotifier.js)

---

## Class: `OPFSNotifier`

| Static Property | Type | Value | Description |
| :--- | :--- | :--- | :--- |
| `CHANNEL_NAME` | `string` | `'opfs'` | The unique identifier used to establish the BroadcastChannel connection. |

### Constructor

| Signature | Description |
| :--- | :--- |
| `new OPFSNotifier(agentName?: string | null)` | **Synchronous.** Initializes the underlying [BaseChannel](../msgChannels/channels/base.js) instance with the static `CHANNEL_NAME`. |

---

## Emitters (Producer Methods)

These methods are called internally by `OPFSFile`/`OPFSDir` entities after a successful I/O operation.

| Method | Event Type | Description | Payload Data (`message.payload.data`) |
| :--- | :--- | :--- | :--- |
| `fileCreated` | `file_created` | A new file was successfully written to the file system. | `{ path: string, bytesH: string }` |
| `fileModified` | `file_modified` | An existing file was overwritten, partially updated, or truncated (`allocate`). | `{ path: string, bytesH: string }` |
| `fileDeleted` | `file_deleted` | A file was deleted from its parent directory. | `{ path: string }` |
| `dirCreated` | `dir_created` | A directory path was created via `makeDir`, `_getHandlePromise(true)`, or a recursive copy. | `{ path: string }` |
| `dirDeleted` | `dir_deleted` | A directory (and its contents) was deleted. | `{ path: string }` |
| `entryMoved` | `entry_moved` | An entity (file or directory) was renamed or moved. | `{ oldPath: string, newPath: string, kind: 'file' \| 'directory' }` |

---

## Listeners (Consumer Methods)

These methods allow any context (Main or Worker) to subscribe to file system changes globally using the injected `.notifier` instance.

| Method | Signature | Description |
| :--- | :--- | :--- |
| `onFileCreated` | `onFileCreated(callback: OPFSNotificationCallback)` | Registers a listener for file creation events. |
| `onFileModified`| `onFileModified(callback: OPFSNotificationCallback)` | Registers a listener for file modification/update events. |
| `onFileDeleted` | `onFileDeleted(callback: OPFSNotificationCallback)` | Registers a listener for file deletion events. |
| `onDirCreated` | `onDirCreated(callback: OPFSNotificationCallback)` | Registers a listener for directory creation events. |
| `onDirDeleted` | `onDirDeleted(callback: OPFSNotificationCallback)` | Registers a listener for directory deletion events. |
| `onEntryMoved` | `onEntryMoved(callback: OPFSNotificationCallback)` | Registers a listener for file or directory move/rename events. |
| `onAnyChange` | `onAnyChange(callback: OPFSNotificationCallback)` | Registers a single listener that fires for **all** file system modification events. |