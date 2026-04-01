import { normalizeInput } from '../envCompare';
import type {
  EnvEntry,
  LineIssue,
  ParsedEnvFile,
  ParsedLine,
  SourceFile,
} from '../envCompare';

function createIssue(
  issue: Omit<LineIssue, 'source'>,
  source: SourceFile,
): LineIssue {
  return {
    ...issue,
    source,
  };
}

function hasContinuation(raw: string) {
  const trimmedEnd = raw.replace(/\s+$/g, '');
  let slashCount = 0;

  for (let index = trimmedEnd.length - 1; index >= 0; index -= 1) {
    if (trimmedEnd[index] !== '\\') {
      break;
    }

    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function stripContinuationMarker(raw: string) {
  const trimmedEnd = raw.replace(/\s+$/g, '');

  return trimmedEnd.slice(0, -1);
}

function unescapePropertiesToken(input: string) {
  let result = '';

  for (let index = 0; index < input.length; index += 1) {
    const current = input[index];

    if (current !== '\\' || index === input.length - 1) {
      result += current;
      continue;
    }

    const next = input[index + 1];

    switch (next) {
      case 't':
        result += '\t';
        index += 1;
        break;
      case 'n':
        result += '\n';
        index += 1;
        break;
      case 'r':
        result += '\r';
        index += 1;
        break;
      case 'f':
        result += '\f';
        index += 1;
        break;
      default:
        result += next;
        index += 1;
        break;
    }
  }

  return result;
}

function findSeparatorRange(line: string) {
  let startIndex = 0;

  while (startIndex < line.length && /\s/.test(line[startIndex] ?? '')) {
    startIndex += 1;
  }

  let keyEnd = line.length;
  let separatorStart = line.length;
  let separatorEnd = line.length;
  let escaped = false;

  for (let index = startIndex; index < line.length; index += 1) {
    const character = line[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === '\\') {
      escaped = true;
      continue;
    }

    if (character === '=' || character === ':') {
      keyEnd = index;
      separatorStart = index;
      separatorEnd = index + 1;
      break;
    }

    if (/\s/.test(character)) {
      keyEnd = index;
      separatorStart = index;
      separatorEnd = index + 1;

      while (separatorEnd < line.length && /\s/.test(line[separatorEnd] ?? '')) {
        separatorEnd += 1;
      }

      if (line[separatorEnd] === '=' || line[separatorEnd] === ':') {
        separatorEnd += 1;

        while (separatorEnd < line.length && /\s/.test(line[separatorEnd] ?? '')) {
          separatorEnd += 1;
        }
      }
      break;
    }
  }

  return {
    keyStart: startIndex,
    keyEnd,
    separatorStart,
    separatorEnd,
  };
}

function buildRenderParts(raw: string) {
  const { keyStart, keyEnd, separatorStart, separatorEnd } = findSeparatorRange(raw);

  if (keyStart >= raw.length) {
    return {
      keyPart: raw,
      separator: '',
      valuePart: '',
      commentPart: '',
    };
  }

  if (separatorStart >= raw.length) {
    return {
      keyPart: raw.slice(0, keyEnd),
      separator: '',
      valuePart: '',
      commentPart: '',
    };
  }

  return {
    keyPart: raw.slice(0, keyEnd),
    separator: raw.slice(separatorStart, separatorEnd),
    valuePart: raw.slice(separatorEnd),
    commentPart: '',
  };
}

function parseLogicalAssignment(line: string) {
  const { keyStart, keyEnd, separatorStart, separatorEnd } = findSeparatorRange(line);
  const keyPart = line.slice(keyStart, keyEnd);
  const normalizedKey = unescapePropertiesToken(keyPart.trimEnd());
  const valuePart =
    separatorStart >= line.length ? '' : line.slice(separatorEnd);

  return {
    key: normalizedKey,
    value: valuePart,
  };
}

export function parseProperties(input: string, source: SourceFile): ParsedEnvFile {
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

    if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
      lines.push({ kind: 'comment', lineNumber, raw });
      continue;
    }

    const rawLines = [raw];
    let logicalLine = raw;
    let foundContinuationEnd = true;

    while (hasContinuation(rawLines[rawLines.length - 1] ?? '')) {
      if (index + 1 >= rows.length) {
        foundContinuationEnd = false;
        break;
      }

      const nextLine = rows[index + 1];
      index += 1;
      rawLines.push(nextLine);
      logicalLine = `${stripContinuationMarker(rawLines[rawLines.length - 2] ?? '')}${nextLine.trimStart()}`;
    }

    if (!foundContinuationEnd) {
      const issue = createIssue(
        {
          code: 'malformed_line',
          severity: 'error',
          message: 'Property continuation was not closed before end of file.',
          lineNumber,
          raw: rawLines.join('\n'),
        },
        source,
      );
      lines.push({
        kind: 'malformed',
        lineNumber,
        raw: rawLines[0],
        issues: [issue],
      });
      rawLines.slice(1).forEach((continuationRaw, continuationIndex) => {
        lines.push({
          kind: 'malformed',
          lineNumber: lineNumber + continuationIndex + 1,
          raw: continuationRaw,
          issues: [],
        });
      });
      issues.push(issue);
      continue;
    }

    const { key, value } = parseLogicalAssignment(logicalLine);

    if (key.length === 0) {
      const issue = createIssue(
        {
          code: 'malformed_line',
          severity: 'error',
          message: 'Expected a property key before the separator.',
          lineNumber,
          raw: rawLines.join('\n'),
        },
        source,
      );
      lines.push({
        kind: 'malformed',
        lineNumber,
        raw: rawLines[0],
        issues: [issue],
      });
      rawLines.slice(1).forEach((continuationRaw, continuationIndex) => {
        lines.push({
          kind: 'malformed',
          lineNumber: lineNumber + continuationIndex + 1,
          raw: continuationRaw,
          issues: [],
        });
      });
      issues.push(issue);
      continue;
    }

    const warnings: LineIssue[] = [];

    if (source === 'env' && value.trim().length === 0) {
      const emptyValueIssue = createIssue(
        {
          code: 'empty_value',
          severity: 'warning',
          message: 'Property value is empty.',
          lineNumber,
          raw: rawLines.join('\n'),
          key,
        },
        source,
      );
      warnings.push(emptyValueIssue);
      issues.push(emptyValueIssue);
    }

    const entry: EnvEntry = {
      key,
      normalizedKey: key,
      value,
      lineNumber,
      source,
      raw: rawLines.join('\n'),
      warnings,
    };

    lines.push({
      kind: 'assignment',
      lineNumber,
      raw: rawLines[0],
      key,
      value,
      normalizedKey: key,
      warnings,
      renderParts: buildRenderParts(rawLines[0]),
    });
    rawLines.slice(1).forEach((continuationRaw, continuationIndex) => {
      lines.push({
        kind: 'continuation',
        lineNumber: lineNumber + continuationIndex + 1,
        raw: continuationRaw,
        normalizedKey: key,
        renderParts: {
          valuePart: continuationRaw,
          commentPart: '',
        },
      });
    });

    validEntries.push(entry);
    const duplicates = seenByKey.get(entry.normalizedKey) ?? [];
    duplicates.push(entry);
    seenByKey.set(entry.normalizedKey, duplicates);
    effectiveState.set(key, entry);
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
              message: 'Duplicate property detected. Last valid value wins.',
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
