import type {
  CompareResult,
  DuplicateGroup,
  EnvEntry,
  EnvironmentCompareInput,
  EnvironmentCompareResult,
  LineIssue,
  ParsedEnvFile,
} from './types';

function toDuplicateGroups(parsed: ParsedEnvFile): DuplicateGroup[] {
  return [...parsed.duplicateMap.entries()]
    .map(([key, entries]) => ({
      key,
      entries,
      lines: entries.map((entry) => entry.lineNumber).sort((left, right) => left - right),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function getMalformedIssues(parsed: ParsedEnvFile): LineIssue[] {
  return parsed.issues
    .filter(
      (issue) =>
        issue.code === 'malformed_line' ||
        issue.code === 'invalid_key_name' ||
        issue.code === 'empty_unquoted_value',
    )
    .sort((left, right) => left.lineNumber - right.lineNumber);
}

function getWarningIssues(parsed: ParsedEnvFile): LineIssue[] {
  return parsed.issues
    .filter(
      (issue) =>
        issue.severity === 'warning' &&
        issue.code !== 'duplicate_key' &&
        issue.code !== 'malformed_line' &&
        issue.code !== 'invalid_key_name' &&
        !(parsed.source === 'template' && issue.code === 'empty_value'),
    )
    .sort((left, right) => left.lineNumber - right.lineNumber);
}

function getEmptyValueEntries(parsed: ParsedEnvFile): EnvEntry[] {
  return parsed.validEntries.filter((entry) =>
    entry.warnings.some((warning) => warning.code === 'empty_value'),
  );
}

export function compareEnvFiles(
  templateFile: ParsedEnvFile,
  environmentFiles: EnvironmentCompareInput[],
): CompareResult {
  const templateEffectiveEntries = templateFile.effectiveEntries;
  const templateKeys = new Set(
    templateEffectiveEntries.map((entry) => entry.normalizedKey),
  );
  const requiredTemplateKeys = templateEffectiveEntries.filter(
    (entry) => entry.value.trim().length === 0,
  );
  const defaultedTemplateKeys = templateEffectiveEntries.filter(
    (entry) => entry.value.trim().length > 0,
  );

  const environments: EnvironmentCompareResult[] = environmentFiles.map((environment) => {
    const envKeys = new Set(
      environment.parsed.effectiveEntries.map((entry) => entry.normalizedKey),
    );
    const envLabelMap = new Map(
      environment.parsed.effectiveEntries.map((entry) => [entry.normalizedKey, entry.key]),
    );

    const missingRequiredKeys = requiredTemplateKeys
      .filter((entry) => !envKeys.has(entry.normalizedKey))
      .map((entry) => ({
        key: entry.key,
        normalizedKey: entry.normalizedKey,
        templateLineNumber: entry.lineNumber,
        suggestedValue: entry.value,
      }))
      .sort((left, right) => left.key.localeCompare(right.key));

    const undocumentedKeys = [...envKeys]
      .filter((key) => !templateKeys.has(key))
      .map((key) => {
        const envEntry = environment.parsed.keyMap.get(key);

        return {
          key: envLabelMap.get(key) ?? key,
          normalizedKey: key,
          envLineNumber: envEntry?.lineNumber ?? 0,
        };
      })
      .sort((left, right) => left.key.localeCompare(right.key));

    const duplicateKeys = toDuplicateGroups(environment.parsed);
    const malformedLines = getMalformedIssues(environment.parsed);
    const emptyValues = getEmptyValueEntries(environment.parsed);
    const warnings = getWarningIssues(environment.parsed);

    return {
      id: environment.id,
      label: environment.label,
      filename: environment.filename,
      missingRequiredKeys,
      undocumentedKeys,
      duplicateKeys,
      malformedLines,
      emptyValues,
      warnings,
      summary: {
        missingRequiredKeys: missingRequiredKeys.length,
        undocumentedKeys: undocumentedKeys.length,
        duplicateGroups: duplicateKeys.length,
        malformedLines: malformedLines.length,
        warningCount: warnings.length,
        emptyValueWarnings: emptyValues.length,
        parsedKeys: environment.parsed.effectiveEntries.length,
        hasIssues:
          missingRequiredKeys.length > 0 ||
          undocumentedKeys.length > 0 ||
          duplicateKeys.length > 0 ||
          malformedLines.length > 0 ||
          warnings.length > 0,
      },
    };
  });

  const templateWarnings = getWarningIssues(templateFile);
  const templateDuplicateKeys = toDuplicateGroups(templateFile);
  const templateMalformedLines = getMalformedIssues(templateFile);

  return {
    template: {
      requiredKeys: requiredTemplateKeys.map((entry) => ({
        key: entry.key,
        normalizedKey: entry.normalizedKey,
        value: entry.value,
        lineNumber: entry.lineNumber,
        hasDefaultValue: false,
      })),
      defaultedKeys: defaultedTemplateKeys.map((entry) => ({
        key: entry.key,
        normalizedKey: entry.normalizedKey,
        value: entry.value,
        lineNumber: entry.lineNumber,
        hasDefaultValue: true,
      })),
      duplicateKeys: templateDuplicateKeys,
      malformedLines: templateMalformedLines,
      warnings: templateWarnings,
    },
    environments,
    summary: {
      environmentCount: environments.length,
      missingRequiredKeys: environments.reduce(
        (total, environment) => total + environment.summary.missingRequiredKeys,
        0,
      ),
      undocumentedKeys: environments.reduce(
        (total, environment) => total + environment.summary.undocumentedKeys,
        0,
      ),
      duplicateGroupsInEnvironments: environments.reduce(
        (total, environment) => total + environment.summary.duplicateGroups,
        0,
      ),
      duplicateGroupsInTemplate: templateDuplicateKeys.length,
      malformedInEnvironments: environments.reduce(
        (total, environment) => total + environment.summary.malformedLines,
        0,
      ),
      malformedInTemplate: templateMalformedLines.length,
      warningCount:
        templateWarnings.length +
        environments.reduce(
          (total, environment) => total + environment.summary.warningCount,
          0,
        ),
      emptyValueWarningsInEnvironments: environments.reduce(
        (total, environment) => total + environment.summary.emptyValueWarnings,
        0,
      ),
      parsedKeysInEnvironments: environments.reduce(
        (total, environment) => total + environment.summary.parsedKeys,
        0,
      ),
      parsedKeysInTemplate: templateFile.effectiveEntries.length,
      environmentsWithIssues: environments.filter((environment) => environment.summary.hasIssues)
        .length,
    },
  };
}
