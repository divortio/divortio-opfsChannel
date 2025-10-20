# `mainOPFS`: Asynchronous File System for the Main Thread

**`mainOPFS`** is a JavaScript library designed to manage the **Origin Private File System (OPFS)** directly from the **Main Browser Thread**. It provides a structured, asynchronous, and cached API over native browser handlers, ensuring the main thread remains responsive while managing file I/O.

---

## ✨ Features

* **🌐 Main Thread Safe:** Uses only **asynchronous** OPFS APIs (`.getFile()`, `.createWritable()`) to avoid blocking the UI thread.
* **🧠 Lazy Execution & Caching:** Properties (like `.bytes`, `.exists`, `.sha256`) are lazy-loaded on first access and cached, dramatically improving performance for repeated metadata checks.
* **📂 Structured Path Management:** Provides clear `OPFSFile` and `OPFSDir` classes for clean, object-oriented navigation and manipulation of the file system hierarchy.
* **✂️ Efficient Stream I/O:** Utilizes Blob slicing for reading and the Writable Stream API for robust, reliable file modifications.

---

## 🚀 Getting Started

The library exports two primary classes: `OPFSFile` for file-specific operations and `OPFSDir` for directory management.

### Installation (Conceptual)

This is an in-house library. Ensure all source files are available and correctly linked.

### Usage Example (in `main.js`)

```javascript
import { OPFSFile, OPFSDir } from './index.js';

async function setupAndReadSettings() {
    // 1. Get a directory handle (or create the object lazily)
    const configDir = new OPFSDir('/app/config/');

    // 2. Create a file object lazily
    const settingsFile = configDir.createFile('settings.json');

    // Check file existence asynchronously
    if (!(await settingsFile.exists)) {
        console.log("Creating default settings file...");
        
        // Write operation requires file creation and asynchronous stream processing
        const defaultData = new TextEncoder().encode('{"theme": "dark"}');
        await settingsFile.writeBytes(defaultData);
    }
    
    // Read cached properties (access is fast after first I/O)
    console.log(`Size on disk: ${await settingsFile.bytesH}`);

    // Read the file content
    const fileData = await settingsFile.readBytes();
    console.log('Read data:', new TextDecoder().decode(fileData));
}

setupAndReadSettings();
````

-----

## 📚 API Documentation

For detailed information on all methods, properties, types, and usage examples, refer to the dedicated documentation files.

| Component | Description | Documentation |
| :--- | :--- | :--- |
| **`OPFSFile`** | Abstraction for managing individual file I/O, properties, and file content access. | [`docs/opfsFile.md`](https://www.google.com/search?q=docs/opfsFile.md) |
| **`OPFSDir`** | Abstraction for managing directory paths, listing contents, and creating/retrieving entries. | [`docs/opfsDir.md`](https://www.google.com/search?q=docs/opfsDir.md) |

-----

## 🛠️ Library Structure

| File | Type | Description | Link |
| :--- | :--- | :--- | :--- |
| `index.js` | Entry Point | Exports the primary classes (`OPFSFile`, `OPFSDir`). | [`index.js`](https://www.google.com/search?q=index.js) |
| `opfsFile.js` | Core Class | The file abstraction layer. Implements asynchronous I/O and caching. | [`opfsFile.js`](https://www.google.com/search?q=opfsFile.js) |
| `opfsDir.js` | Core Class | The directory abstraction layer. Implements asynchronous path traversal and entry management. | [`opfsDir.js`](https://www.google.com/search?q=opfsDir.js) |
| `utils.js` | Utilities | Contains pure functions (path parsing, MIME types) and asynchronous handle retrieval logic. | [`utils.js`](https://www.google.com/search?q=utils.js) |
