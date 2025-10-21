/**
 * @fileoverview Main entry point for the Worker & Main OPFS library.
 */
import { OPFSWorkerFile } from './worker/opfsWorkerFile.js';
import { OPFSWorkerDirectory } from './worker/opfsWorkerDir.js';
import { OPFSDir } from './main/opfsDir.js';
import { OPFSFile } from './main/opfsFile.js';
import { OPFSMain } from './main/opfsMain.js';
import { OPFSWorker } from './worker/opfsWorker.js';
import { OPFSNotifier } from './OPFSNotifier.js'; // <-- NEW IMPORT


// Export the core classes for developers
export {
    OPFSWorkerFile,
    OPFSWorkerDirectory,
    OPFSDir,
    OPFSFile,
    OPFSMain,
    OPFSWorker,
    OPFSNotifier // <-- NEW EXPORT
};