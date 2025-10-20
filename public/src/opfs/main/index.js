/**
 * @fileoverview Main entry point for the mainOPFS library.
 * Exports the primary file and directory abstraction classes for use in the Main Thread.
 */
import { OPFSFile } from './opfsFile.js';
import { OPFSDir } from './opfsDir.js';

// Export the core asynchronous OPFS abstraction classes
export {
    OPFSFile,
    OPFSDir
};