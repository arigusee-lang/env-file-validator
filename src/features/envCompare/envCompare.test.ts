import { describe, expect, it } from 'vitest';
import {
  buildPlainTextReport,
  compareEnvFiles,
  generateTemplate,
  parseEnv,
} from './index';

describe('env compare core logic', () => {
  it('parses assignments, warnings, duplicates, and malformed lines', () => {
    const parsed = parseEnv(
      ['FOO=bar', ' BAR=baz', 'EMPTY=', 'BAD-NAME=value', 'FOO=override'].join('\n'),
      'env',
    );

    expect(parsed.validEntries).toHaveLength(3);
    expect(parsed.effectiveEntries).toHaveLength(2);
    expect(parsed.duplicateMap.get('FOO')).toHaveLength(2);
    expect(parsed.issues.some((issue) => issue.code === 'whitespace_issue')).toBe(true);
    expect(parsed.issues.some((issue) => issue.code === 'empty_unquoted_value')).toBe(true);
    expect(parsed.issues.some((issue) => issue.code === 'invalid_key_name')).toBe(true);
  });

  it('treats quoted empty env values as warnings, not malformed lines', () => {
    const parsed = parseEnv(['JWT_SECRET=""'].join('\n'), 'env');

    expect(parsed.validEntries).toHaveLength(1);
    expect(parsed.issues.some((issue) => issue.code === 'empty_value')).toBe(true);
    expect(parsed.issues.some((issue) => issue.code === 'empty_unquoted_value')).toBe(false);
  });

  it('treats quoted whitespace-only env values as warnings', () => {
    const parsed = parseEnv(['LOG_LEVEL=" "'].join('\n'), 'env');

    expect(parsed.validEntries).toHaveLength(1);
    expect(parsed.issues.some((issue) => issue.code === 'empty_value')).toBe(true);
    expect(parsed.issues.some((issue) => issue.code === 'empty_unquoted_value')).toBe(false);
  });

  it('supports dotenv-style multiline quoted values', () => {
    const parsed = parseEnv(
      ['PRIVATE_KEY="-----BEGIN KEY-----', 'abc123', '-----END KEY-----"'].join('\n'),
      'env',
    );

    expect(parsed.validEntries).toHaveLength(1);
    expect(parsed.lines).toHaveLength(3);
    expect(parsed.validEntries[0]?.value).toContain('\nabc123\n');
    expect(parsed.issues).toHaveLength(0);
  });

  it('strips inline comments from unquoted values and preserves hashes in quoted values', () => {
    const parsed = parseEnv(
      ['LOG_LEVEL=debug # inline comment', 'PUBLIC_TEXT="hello # world" # trailing comment'].join(
        '\n',
      ),
      'env',
    );

    expect(parsed.validEntries).toHaveLength(2);
    expect(parsed.validEntries[0]?.value).toBe('debug');
    expect(parsed.validEntries[1]?.value).toBe('"hello # world"');
  });

  it('supports multiline quoted values with a trailing comment after the closing quote', () => {
    const parsed = parseEnv(
      ['PRIVATE_KEY="-----BEGIN KEY-----', 'abc123', '-----END KEY-----" # secret'].join('\n'),
      'env',
    );

    expect(parsed.validEntries).toHaveLength(1);
    expect(parsed.validEntries[0]?.value).toBe(
      '"-----BEGIN KEY-----\nabc123\n-----END KEY-----"',
    );
  });

  it('treats trailing characters after a closing quote as malformed', () => {
    const parsed = parseEnv(['JWT_SECRET="abc"junk'].join('\n'), 'env');

    expect(parsed.validEntries).toHaveLength(0);
    expect(parsed.effectiveEntries).toHaveLength(0);
    expect(parsed.issues.some((issue) => issue.code === 'malformed_line')).toBe(true);
    expect(parsed.issues.some((issue) => issue.message.includes('closing quote'))).toBe(true);
  });

  it('does not count multiline template defaults as missing', () => {
    const template = parseEnv(
      ['PRIVATE_KEY="-----BEGIN KEY-----', 'abc123', '-----END KEY-----"'].join('\n'),
      'template',
    );
    const env = parseEnv(['LOG_LEVEL=info'].join('\n'), 'env');
    const result = compareEnvFiles(template, [
      {
        id: 'env-1',
        label: 'Environment 1',
        filename: '.env.dev',
        parsed: env,
      },
    ]);

    expect(result.template.defaultedKeys.map((entry) => entry.key)).toEqual(['PRIVATE_KEY']);
    expect(result.environments[0].missingRequiredKeys).toHaveLength(0);
  });

  it('compares multiple environments against one template', () => {
    const template = parseEnv(
      ['FOO=', 'BAR=default', 'BAZ=', 'BAR=override', 'BAD-NAME=value'].join('\n'),
      'template',
    );
    const local = parseEnv(['FOO=1', 'EXTRA=1'].join('\n'), 'env');
    const prod = parseEnv(['BAZ=2', 'FOO=3', 'FOO=4'].join('\n'), 'env');
    const result = compareEnvFiles(template, [
      {
        id: 'local',
        label: 'Environment 1',
        filename: '.env.local',
        parsed: local,
      },
      {
        id: 'prod',
        label: 'Environment 2',
        filename: '.env.prod',
        parsed: prod,
      },
    ]);

    expect(result.template.requiredKeys.map((entry) => entry.key)).toEqual(['FOO', 'BAZ']);
    expect(result.template.defaultedKeys.map((entry) => entry.key)).toEqual(['BAR']);
    expect(result.template.duplicateKeys).toHaveLength(1);
    expect(result.template.malformedLines).toHaveLength(1);
    expect(result.environments[0].missingRequiredKeys.map((entry) => entry.key)).toEqual(['BAZ']);
    expect(result.environments[0].undocumentedKeys.map((entry) => entry.key)).toEqual(['EXTRA']);
    expect(result.environments[1].missingRequiredKeys).toHaveLength(0);
    expect(result.environments[1].duplicateKeys).toHaveLength(1);
    expect(result.summary.missingRequiredKeys).toBe(1);
    expect(result.summary.undocumentedKeys).toBe(1);
    expect(result.summary.duplicateGroupsInTemplate).toBe(1);
  });

  it('does not count defaulted template values as missing', () => {
    const template = parseEnv(['FOO=bar', 'BAR='].join('\n'), 'template');
    const env = parseEnv(['BAR=1'].join('\n'), 'env');
    const result = compareEnvFiles(template, [
      {
        id: 'env-1',
        label: 'Environment 1',
        filename: '.env.local',
        parsed: env,
      },
    ]);

    expect(result.environments[0].missingRequiredKeys.map((entry) => entry.key)).toEqual([]);
    expect(result.summary.missingRequiredKeys).toBe(0);
  });

  it('treats unquoted empty env values as malformed and still missing when required', () => {
    const template = parseEnv(['JWT_SECRET='].join('\n'), 'template');
    const env = parseEnv(['JWT_SECRET='].join('\n'), 'env');
    const result = compareEnvFiles(template, [
      {
        id: 'env-1',
        label: 'Environment 1',
        filename: '.env.dev',
        parsed: env,
      },
    ]);

    expect(result.environments[0].missingRequiredKeys.map((entry) => entry.key)).toEqual([
      'JWT_SECRET',
    ]);
    expect(result.environments[0].malformedLines.some((issue) => issue.code === 'empty_unquoted_value')).toBe(true);
    expect(result.environments[0].warnings).toHaveLength(0);
  });

  it('treats a later invalid duplicate assignment as overriding the earlier valid one', () => {
    const template = parseEnv(['JWT_SECRET='].join('\n'), 'template');
    const env = parseEnv(['JWT_SECRET=ok', 'JWT_SECRET='].join('\n'), 'env');
    const result = compareEnvFiles(template, [
      {
        id: 'env-1',
        label: 'Environment 1',
        filename: '.env.dev',
        parsed: env,
      },
    ]);

    expect(result.environments[0].missingRequiredKeys.map((entry) => entry.key)).toEqual([
      'JWT_SECRET',
    ]);
    expect(result.environments[0].duplicateKeys).toHaveLength(1);
    expect(result.environments[0].duplicateKeys[0]?.lines).toEqual([1, 2]);
    expect(result.environments[0].malformedLines.some((issue) => issue.code === 'empty_unquoted_value')).toBe(true);
  });

  it('generates a stripped template from valid keys', () => {
    const env = parseEnv(['FOO=1', 'BAR=2', 'FOO=3', 'BAD-NAME=value'].join('\n'), 'env');

    expect(generateTemplate(env)).toBe(['FOO=', 'BAR='].join('\n'));
  });

  it('builds a plain text report without leaking values', () => {
    const template = parseEnv(['FOO=', 'BAR=default'].join('\n'), 'template');
    const env = parseEnv(['BAR=1', 'EXTRA=2', 'BAD-NAME=value'].join('\n'), 'env');
    const result = compareEnvFiles(template, [
      {
        id: 'env-1',
        label: 'Environment 1',
        filename: '.env.local',
        parsed: env,
      },
    ]);
    const report = buildPlainTextReport(result);

    expect(report).toContain('Missing required keys');
    expect(report).not.toContain('Warnings');
    expect(report).not.toContain('EXTRA is undocumented in .env.local');
    expect(report).not.toContain('Env validator report');
    expect(report).not.toContain('Environments checked');
    expect(report).not.toContain('=1');
    expect(report).not.toContain('=2');
  });

  it('ignores empty template placeholders in warnings', () => {
    const template = parseEnv(['FOO=', 'BAR=', 'BAZ='].join('\n'), 'template');
    const env = parseEnv(['FOO=1', 'BAR=2'].join('\n'), 'env');
    const result = compareEnvFiles(template, [
      {
        id: 'env-1',
        label: 'Environment 1',
        filename: '.env.local',
        parsed: env,
      },
    ]);

    expect(result.template.warnings).toHaveLength(0);
    expect(result.summary.warningCount).toBe(0);
    expect(result.environments[0].missingRequiredKeys.map((entry) => entry.key)).toEqual([
      'BAZ',
    ]);
  });
});
