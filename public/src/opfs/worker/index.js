/**
 * @fileoverview Main entry point for the workerOPFS library.
 * Exports the primary file and directory abstraction classes for use in Web Workers.
 */
import { OPFSWorkerFile } from './opfsWorkerFile.js';
import { OPFSWorkerDirectory } from './opfsWorkerDir.js';
import { OPFSWorker } from './opfsWorker.js'; // <-- NEW IMPORT

// Export the core classes for developers
export {
    OPFSWorkerFile,
    OPFSWorkerDirectory,
    OPFSWorker // <-- NEW EXPORT
};