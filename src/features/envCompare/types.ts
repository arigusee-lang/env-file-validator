export type SourceFile = 'env' | 'template';

export type IssueSeverity = 'error' | 'warning';

export type LineIssueCode =
  | 'malformed_line'
  | 'invalid_key_name'
  | 'duplicate_key'
  | 'empty_unquoted_value'
  | 'empty_value'
  | 'whitespace_issue';

export type LineIssue = {
  code: LineIssueCode;
  severity: IssueSeverity;
  message: string;
  lineNumber: number;
  source: SourceFile;
  raw: string;
  key?: string;
};

export type EnvEntry = {
  key: string;
  normalizedKey: string;
  value: string;
  lineNumber: number;
  source: SourceFile;
  raw: string;
  warnings: LineIssue[];
};

export type ParsedLine =
  | {
      kind: 'blank' | 'comment';
      lineNumber: number;
      raw: string;
    }
  | {
      kind: 'assignment';
      lineNumber: number;
      raw: string;
      key: string;
      value: string;
      normalizedKey: string;
      warnings: LineIssue[];
    }
  | {
      kind: 'continuation';
      lineNumber: number;
      raw: string;
      normalizedKey: string;
    }
  | {
      kind: 'malformed';
      lineNumber: number;
      raw: string;
      issues: LineIssue[];
    };

export type DuplicateGroup = {
  key: string;
  entries: EnvEntry[];
  lines: number[];
};

export type ParsedEnvFile = {
  source: SourceFile;
  originalText: string;
  lines: ParsedLine[];
  validEntries: EnvEntry[];
  effectiveEntries: EnvEntry[];
  issues: LineIssue[];
  keyMap: Map<string, EnvEntry>;
  duplicateMap: Map<string, EnvEntry[]>;
};

export type EnvironmentCompareInput = {
  id: string;
  label: string;
  filename: string;
  parsed: ParsedEnvFile;
};

export type ComparedTemplateKey = {
  key: string;
  normalizedKey: string;
  value: string;
  lineNumber: number;
  hasDefaultValue: boolean;
};

export type MissingKeyDetail = {
  key: string;
  normalizedKey: string;
  templateLineNumber: number;
  suggestedValue: string;
};

export type UndocumentedKeyDetail = {
  key: string;
  normalizedKey: string;
  envLineNumber: number;
};

export type EnvironmentCompareSummary = {
  missingRequiredKeys: number;
  undocumentedKeys: number;
  duplicateGroups: number;
  malformedLines: number;
  warningCount: number;
  emptyValueWarnings: number;
  parsedKeys: number;
  hasIssues: boolean;
};

export type EnvironmentCompareResult = {
  id: string;
  label: string;
  filename: string;
  missingRequiredKeys: MissingKeyDetail[];
  undocumentedKeys: UndocumentedKeyDetail[];
  duplicateKeys: DuplicateGroup[];
  malformedLines: LineIssue[];
  emptyValues: EnvEntry[];
  warnings: LineIssue[];
  summary: EnvironmentCompareSummary;
};

export type CompareSummary = {
  environmentCount: number;
  missingRequiredKeys: number;
  undocumentedKeys: number;
  duplicateGroupsInEnvironments: number;
  duplicateGroupsInTemplate: number;
  malformedInEnvironments: number;
  malformedInTemplate: number;
  warningCount: number;
  emptyValueWarningsInEnvironments: number;
  parsedKeysInEnvironments: number;
  parsedKeysInTemplate: number;
  environmentsWithIssues: number;
};

export type CompareResult = {
  template: {
    requiredKeys: ComparedTemplateKey[];
    defaultedKeys: ComparedTemplateKey[];
    duplicateKeys: DuplicateGroup[];
    malformedLines: LineIssue[];
    warnings: LineIssue[];
  };
  environments: EnvironmentCompareResult[];
  summary: CompareSummary;
};
