import { describe, expect, it } from 'vitest';
import { buildPlainTextReport, type EnvironmentCompareInput } from '../envCompare';
import { canQuickFixPropertiesText, comparePropertiesFiles, parseProperties, quickFixPropertiesText } from './index';

describe('properties compare logic', () => {
  it('parses properties assignments, comments, duplicates, and empty values', () => {
    const parsed = parseProperties(
      ['# comment', 'app.name=validator', 'feature.enabled true', 'feature.enabled=false', 'empty.value='].join('\n'),
      'env',
    );

    expect(parsed.validEntries).toHaveLength(4);
    expect(parsed.effectiveEntries).toHaveLength(3);
    expect(parsed.duplicateMap.get('feature.enabled')).toHaveLength(2);
    expect(parsed.issues.some((issue) => issue.code === 'duplicate_key')).toBe(true);
    expect(parsed.issues.some((issue) => issue.code === 'empty_value')).toBe(true);
  });

  it('supports continuation lines in values', () => {
    const parsed = parseProperties(
      ['banner.message=Welcome \\', '  team'].join('\n'),
      'template',
    );

    expect(parsed.validEntries).toHaveLength(1);
    expect(parsed.lines).toHaveLength(2);
    expect(parsed.validEntries[0]?.value).toBe('Welcome team');
  });

  it('treats empty keys as malformed', () => {
    const parsed = parseProperties(['=value'].join('\n'), 'env');

    expect(parsed.validEntries).toHaveLength(0);
    expect(parsed.issues.some((issue) => issue.code === 'malformed_line')).toBe(true);
  });

  it('compares runtime files against all template properties', () => {
    const template = parseProperties(
      ['app.name=Validator', 'db.url=', 'feature.enabled=true'].join('\n'),
      'template',
    );
    const env = parseProperties(['app.name=Validator Dev', 'extra.flag=true', 'db.url='].join('\n'), 'env');
    const result = comparePropertiesFiles(template, [
      {
        id: 'env-1',
        label: 'Environment 1',
        filename: 'application-dev.properties',
        parsed: env,
      } satisfies EnvironmentCompareInput,
    ]);

    expect(result.environments[0].missingRequiredKeys.map((entry) => entry.key)).toEqual([
      'feature.enabled',
    ]);
    expect(result.environments[0].undocumentedKeys.map((entry) => entry.key)).toEqual([
      'extra.flag',
    ]);
    expect(result.environments[0].warnings.some((issue) => issue.code === 'empty_value')).toBe(true);
  });

  it('builds a compact error-only report for properties results', () => {
    const template = parseProperties(['db.url=', 'feature.enabled=true'].join('\n'), 'template');
    const env = parseProperties(['db.url=jdbc:test', 'extra.flag=true', '=oops'].join('\n'), 'env');
    const result = comparePropertiesFiles(template, [
      {
        id: 'env-1',
        label: 'Environment 1',
        filename: 'application-prod.properties',
        parsed: env,
      } satisfies EnvironmentCompareInput,
    ]);

    const report = buildPlainTextReport(result);

    expect(report).toContain('Missing required keys');
    expect(report).toContain('Malformed lines');
    expect(report).not.toContain('Warnings');
    expect(report).not.toContain('extra.flag');
  });

  it('quick-fixes properties files by removing malformed lines, normalizing line endings, and keeping the last valid duplicate', () => {
    const input = ['# comment', 'feature.enabled=true', 'feature.enabled=false', '=broken', '', 'db.url=jdbc:test'].join('\r\n');
    const parsed = parseProperties(input, 'env');

    expect(canQuickFixPropertiesText(input, parsed)).toBe(true);
    expect(quickFixPropertiesText(input, parsed)).toBe(
      ['# comment', 'feature.enabled=false', '', 'db.url=jdbc:test', ''].join('\n'),
    );
  });
});
