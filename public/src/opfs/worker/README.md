
# `workerOPFS`: High-Performance Web Worker File System

> **`workerOPFS`** is a JavaScript library built for performance-critical applications running exclusively within **Web Workers**. It provides a robust, senior-engineer-designed abstraction layer over the browser's native **Origin Private File System (OPFS)**, prioritizing synchronous I/O, lazy execution, and intelligent data caching for maximum speed and efficiency.

-----

## ✨ Features

* **⚡ High-Speed I/O:** Leverages the **Synchronous Access Handle** for the fastest possible byte-level read/write operations within a Web Worker.
* **🧠 Lazy Execution & Caching:** Properties (like `.bytes`, `.exists`, `.sha256`) are lazy-loaded on first access and cached, making repeated metadata checks instantaneous.
* **🔗 SharedArrayBuffer Support:** Dedicated methods for zero-copy data transfer between the file system and inter-worker communication channels.
* **🧱 Modular & Maintainable:** Built entirely on plain JavaScript and native browser APIs, promoting a clean, extensible codebase without external dependencies.

-----

## 🚀 Getting Started

Since this library is designed for the Web Worker environment, it must be imported using standard ES Modules syntax within your Worker script.

### Installation (Conceptual)

This is an in-house library. Ensure the source files (`index.js`, `opfsWorkerFile.js`, etc.) are available to your Worker script.

### Usage Example (in `worker.js`)

```javascript
// worker.js
import { OPFSWorkerFile, OPFSWorkerDirectory } from './index.js';

async function processFile(filePath) {
    const file = new OPFSWorkerFile(filePath); // SYNCHRONOUS instantiation

    if (!(await file.exists)) {
        const dir = await file.parentDir;
        console.log(`Parent directory exists: ${await dir.exists}`);
        
        // Write data, which implicitly creates the file and necessary directories
        const data = new TextEncoder().encode('Hello FANG!');
        await file.writeBytes(data, 0);
    }
    
    // Read cached properties (instant access after first fetch)
    console.log(`File Size: ${await file.bytesH} (${await file.bytes} bytes)`);

    // Use high-performance batch update
    await file.update(handle => {
        // Direct, synchronous file system calls here
        handle.truncate(0); 
    });
}

processFile('/user/data/logs/startup.log');
```

-----

## 📚 API Documentation

For detailed information on all methods, properties, and usage examples, refer to the dedicated documentation files.

| Component | Description | Documentation |
| :--- | :--- | :--- |
| **`OPFSWorkerFile`** | Abstraction for managing an individual file, focusing on I/O, binary data, and metadata. | [`docs/OPFSWorkerFile.md`](https://www.google.com/search?q=docs/OPFSWorkerFile.md) |
| **`OPFSWorkerDirectory`** | Abstraction for managing directory paths, creating/retrieving entries, and managing directory metadata. | [`docs/OPFSWorkerDir.md`](https://www.google.com/search?q=docs/OPFSWorkerDir.md) |

-----

## 🛠️ Library Structure

| File | Type | Description | Link |
| :--- | :--- | :--- | :--- |
| `index.js` | Entry Point | Exports the primary classes (`OPFSWorkerFile`, `OPFSWorkerDirectory`). | [`index.js`](https://www.google.com/search?q=index.js) |
| `opfsWorkerFile.js` | Core Class | The file abstraction layer. Implements I/O, caching, and SHA256 hashing. | [`opfsWorkerFile.js`](https://www.google.com/search?q=opfsWorkerFile.js) |
| `opfsWorkerDir.js` | Core Class | The directory abstraction layer. Implements path traversal and entry management. | [`opfsWorkerDir.js`](https://www.google.com/search?q=opfsWorkerDir.js) |
| `utils.js` | Utilities | Contains pure functions for path parsing, MIME type mapping, bytes conversion, and the critical low-level I/O wrappers. | [`utils.js`](https://www.google.com/search?q=utils.js) |