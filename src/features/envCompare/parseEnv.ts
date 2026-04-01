import { normalizeInput } from './normalizeInput';
import type {
  EnvEntry,
  LineIssue,
  ParsedEnvFile,
  ParsedLine,
  SourceFile,
} from './types';

const VALID_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const EXPORT_PREFIX = /^export\s+/;
const QUOTED_VALUE_WRAPPERS = new Set(['"', "'", '`']);

function isQuotedBlankString(value: string) {
  const trimmed = value.trim();
  const quote = trimmed[0];

  if (
    trimmed.length < 2 ||
    !QUOTED_VALUE_WRAPPERS.has(quote) ||
    trimmed[trimmed.length - 1] !== quote
  ) {
    return false;
  }

  return trimmed.slice(1, -1).trim().length === 0;
}

function findClosingQuoteIndex(value: string, quote: string, startIndex: number) {
  for (let index = startIndex; index < value.length; index += 1) {
    if (value[index] === quote && value[index - 1] !== '\\') {
      return index;
    }
  }

  return -1;
}

function getMultilineQuote(value: string) {
  const trimmedStart = value.trimStart();
  const quote = trimmedStart[0];

  if (!QUOTED_VALUE_WRAPPERS.has(quote)) {
    return null;
  }

  return findClosingQuoteIndex(trimmedStart, quote, 1) === -1 ? quote : null;
}

function normalizeParsedValue(value: string) {
  const trimmedStart = value.trimStart();
  const quote = trimmedStart[0];

  if (QUOTED_VALUE_WRAPPERS.has(quote)) {
    const closingQuoteIndex = findClosingQuoteIndex(trimmedStart, quote, 1);

    if (closingQuoteIndex !== -1) {
      const trailingText = trimmedStart.slice(closingQuoteIndex + 1);
      const trailingCommentIndex = trailingText.indexOf('#');
      const trailingValueSegment =
        trailingCommentIndex === -1
          ? trailingText
          : trailingText.slice(0, trailingCommentIndex);
      const hasTrailingJunk =
        trailingText.trim().length > 0 && trailingValueSegment.trim().length > 0;

      return {
        value: trimmedStart.slice(0, closingQuoteIndex + 1),
        hasTrailingJunk,
      };
    }

    return {
      value,
      hasTrailingJunk: false,
    };
  }

  const commentIndex = value.indexOf('#');
  const uncommentedValue = commentIndex === -1 ? value : value.slice(0, commentIndex);

  return {
    value: uncommentedValue.trim(),
    hasTrailingJunk: false,
  };
}

function createIssue(
  issue: Omit<LineIssue, 'source'>,
  source: SourceFile,
): LineIssue {
  return {
    ...issue,
    source,
  };
}

function getUnsupportedKeyCharacters(key: string) {
  if (key.length === 0) {
    return '=';
  }

  const invalidCharacters = new Set<string>();
  const [firstCharacter = '', ...remainingCharacters] = Array.from(key);

  if (!/[A-Za-z_]/.test(firstCharacter)) {
    invalidCharacters.add(firstCharacter);
  }

  remainingCharacters.forEach((character) => {
    if (!/[A-Za-z0-9_]/.test(character)) {
      invalidCharacters.add(character);
    }
  });

  return Array.from(invalidCharacters).join(', ');
}

export function parseEnv(input: string, source: SourceFile): ParsedEnvFile {
  const normalizedInput = normalizeInput(input);
  const rows = normalizedInput.split('\n');
  const lines: ParsedLine[] = [];
  const issues: LineIssue[] = [];
  const validEntries: EnvEntry[] = [];
  const effectiveState = new Map<string, EnvEntry | null>();
  const seenByKey = new Map<string, EnvEntry[]>();

  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index];
    const lineNumber = index + 1;
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      lines.push({ kind: 'blank', lineNumber, raw });
      continue;
    }

    if (trimmed.startsWith('#')) {
      lines.push({ kind: 'comment', lineNumber, raw });
      continue;
    }

    const hadLeadingWhitespace = raw !== raw.trimStart();
    const normalizedRaw = raw.trimStart().replace(EXPORT_PREFIX, '');
    const separatorIndex = normalizedRaw.indexOf('=');

    if (separatorIndex === -1) {
      const malformedIssue = createIssue(
        {
          code: 'malformed_line',
          severity: 'error',
          message: 'Expected a KEY=value assignment.',
          lineNumber,
          raw,
        },
        source,
      );

      lines.push({
        kind: 'malformed',
        lineNumber,
        raw,
        issues: [malformedIssue],
      });
      issues.push(malformedIssue);
      continue;
    }

    const rawKeySegment = normalizedRaw.slice(0, separatorIndex);
    let value = normalizedRaw.slice(separatorIndex + 1);
    const key = rawKeySegment.trim();
    const warnings: LineIssue[] = [];
    const rawLines = [raw];
    const pushSeenEntry = (entry: EnvEntry) => {
      const duplicates = seenByKey.get(entry.normalizedKey) ?? [];
      duplicates.push(entry);
      seenByKey.set(entry.normalizedKey, duplicates);
    };

    if (hadLeadingWhitespace || rawKeySegment !== key) {
      const whitespaceIssue = createIssue(
        {
          code: 'whitespace_issue',
          severity: 'warning',
          message: 'Whitespace around the key was trimmed during parsing.',
          lineNumber,
          raw,
          key,
        },
        source,
      );
      warnings.push(whitespaceIssue);
      issues.push(whitespaceIssue);
    }

    if (!VALID_KEY_PATTERN.test(key)) {
      const unsupportedCharacters = getUnsupportedKeyCharacters(key);
      const invalidKeyIssue = createIssue(
        {
          code: 'invalid_key_name',
          severity: 'error',
          message: `Key name contains unsupported characters (${unsupportedCharacters}).`,
          lineNumber,
          raw,
          key,
        },
        source,
      );

      lines.push({
        kind: 'malformed',
        lineNumber,
        raw,
        issues: [invalidKeyIssue],
      });
      issues.push(invalidKeyIssue);
      continue;
    }

    const multilineQuote = getMultilineQuote(value);

    if (multilineQuote) {
      let foundClosingQuote = false;

      while (index + 1 < rows.length) {
        index += 1;
        const continuationRaw = rows[index];

        rawLines.push(continuationRaw);
        value = `${value}\n${continuationRaw}`;

        if (findClosingQuoteIndex(continuationRaw, multilineQuote, 0) !== -1) {
          foundClosingQuote = true;
          break;
        }
      }

      if (!foundClosingQuote) {
        const unresolvedEntry: EnvEntry = {
          key,
          normalizedKey: key,
          value,
          lineNumber,
          source,
          raw: rawLines.join('\n'),
          warnings: [],
        };

        pushSeenEntry(unresolvedEntry);
        effectiveState.set(key, null);

        const unclosedQuotedValueIssue = createIssue(
          {
            code: 'malformed_line',
            severity: 'error',
            message: 'Quoted value was not closed before end of file.',
            lineNumber,
            raw: rawLines.join('\n'),
            key,
          },
          source,
        );

        lines.push({
          kind: 'malformed',
          lineNumber,
          raw: rawLines[0],
          issues: [unclosedQuotedValueIssue],
        });
        rawLines.slice(1).forEach((continuationRaw, continuationIndex) => {
          lines.push({
            kind: 'malformed',
            lineNumber: lineNumber + continuationIndex + 1,
            raw: continuationRaw,
            issues: [],
          });
        });
        issues.push(unclosedQuotedValueIssue);
        continue;
      }
    }

    const normalizedValue = normalizeParsedValue(value);
    value = normalizedValue.value;
    const trimmedValue = value.trim();

    const assignmentEntry: EnvEntry = {
      key,
      normalizedKey: key,
      value,
      lineNumber,
      source,
      raw: rawLines.join('\n'),
      warnings,
    };

    if (normalizedValue.hasTrailingJunk) {
      pushSeenEntry(assignmentEntry);
      effectiveState.set(key, null);

      const trailingCharactersIssue = createIssue(
        {
          code: 'malformed_line',
          severity: 'error',
          message: 'Unexpected characters found after the closing quote.',
          lineNumber,
          raw: rawLines.join('\n'),
          key,
        },
        source,
      );

      lines.push({
        kind: 'malformed',
        lineNumber,
        raw: rawLines[0],
        issues: [trailingCharactersIssue],
      });
      rawLines.slice(1).forEach((continuationRaw, continuationIndex) => {
        lines.push({
          kind: 'malformed',
          lineNumber: lineNumber + continuationIndex + 1,
          raw: continuationRaw,
          issues: [],
        });
      });
      issues.push(trailingCharactersIssue);
      continue;
    }

    if (source === 'env' && trimmedValue.length === 0) {
      pushSeenEntry(assignmentEntry);
      effectiveState.set(key, null);

      const emptyUnquotedValueIssue = createIssue(
        {
          code: 'empty_unquoted_value',
          severity: 'error',
          message: 'Value is missing. Use KEY="" only when an explicit empty string is intended.',
          lineNumber,
          raw: rawLines.join('\n'),
          key,
        },
        source,
      );

      lines.push({
        kind: 'assignment',
        lineNumber,
        raw: rawLines[0],
        key,
        value,
        normalizedKey: key,
        warnings,
      });
      rawLines.slice(1).forEach((continuationRaw, continuationIndex) => {
        lines.push({
          kind: 'continuation',
          lineNumber: lineNumber + continuationIndex + 1,
          raw: continuationRaw,
          normalizedKey: key,
        });
      });
      issues.push(emptyUnquotedValueIssue);
      continue;
    }

    if (source === 'env' && isQuotedBlankString(value)) {
      const emptyValueIssue = createIssue(
        {
          code: 'empty_value',
          severity: 'warning',
          message: 'Value is an explicit empty or whitespace-only string literal.',
          lineNumber,
          raw: rawLines.join('\n'),
          key,
        },
        source,
      );
      warnings.push(emptyValueIssue);
      issues.push(emptyValueIssue);
    }

    lines.push({
      kind: 'assignment',
      lineNumber,
      raw: rawLines[0],
      key,
      value,
      normalizedKey: key,
      warnings,
    });
    rawLines.slice(1).forEach((continuationRaw, continuationIndex) => {
      lines.push({
        kind: 'continuation',
        lineNumber: lineNumber + continuationIndex + 1,
        raw: continuationRaw,
        normalizedKey: key,
        });
      });
    validEntries.push(assignmentEntry);
    pushSeenEntry(assignmentEntry);
    effectiveState.set(key, assignmentEntry);
  }

  const duplicateMap = new Map<string, EnvEntry[]>();
  const keyMap = new Map<string, EnvEntry>();

  effectiveState.forEach((entry, key) => {
    if (entry) {
      keyMap.set(key, entry);
    }
  });

  seenByKey.forEach((entries, key) => {
    if (entries.length > 1) {
      duplicateMap.set(key, entries);

      entries.forEach((entry) => {
        issues.push(
          createIssue(
            {
              code: 'duplicate_key',
              severity: 'error',
              message: 'Duplicate key detected. Last valid value wins.',
              lineNumber: entry.lineNumber,
              raw: entry.raw,
              key: entry.key,
            },
            source,
          ),
        );
      });
    }
  });

  return {
    source,
    originalText: normalizedInput,
    lines,
    validEntries,
    effectiveEntries: [...keyMap.values()],
    issues,
    keyMap,
    duplicateMap,
  };
}
