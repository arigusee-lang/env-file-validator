export { buildPlainTextReport } from './buildPlainTextReport';
export { compareEnvFiles } from './compareEnvFiles';
export { generateTemplate } from './generateTemplate';
export { normalizeInput } from './normalizeInput';
export { parseEnv } from './parseEnv';
export type {
  CompareResult,
  CompareSummary,
  DuplicateGroup,
  EnvEntry,
  EnvironmentCompareInput,
  EnvironmentCompareResult,
  EnvironmentCompareSummary,
  LineIssue,
  MissingKeyDetail,
  ParsedEnvFile,
  ParsedLine,
  ComparedTemplateKey,
  SourceFile,
  UndocumentedKeyDetail,
} from './types';
