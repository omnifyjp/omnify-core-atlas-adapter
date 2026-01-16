/**
 * @famgia/omnify-atlas - Diff Module
 */

export type {
  SqlOperationType,
  ChangeSeverity,
  ParsedStatement,
  TableChange,
  DiffResult,
  DiffSummary,
} from './types.js';

export {
  parseDiffOutput,
  formatDiffSummary,
} from './parser.js';
