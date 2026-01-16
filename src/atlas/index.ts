/**
 * @famgia/omnify-atlas - Atlas Module
 */

export type {
  AtlasConfig,
  AtlasDiffOptions,
  AtlasResult,
  AtlasDiffResult,
  AtlasInspectResult,
  AtlasVersion,
} from './types.js';

export {
  checkAtlasVersion,
  runAtlasDiff,
  diffHclSchemas,
  validateHcl,
  applySchema,
} from './runner.js';
