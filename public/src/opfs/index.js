/**
 * @fileoverview Main entry point for the Worker & Main OPFS library.
 */
import { OPFSWorkerFile } from './worker/index.js';
import { OPFSWorkerDirectory } from './worker/index.js';
import { OPFSDir } from './main/index.js';
import { OPFSFile } from './main/index.js';

// Export the core classes for developers
export {
    OPFSWorkerFile,
    OPFSWorkerDirectory,
    OPFSDir,
    OPFSFile
};