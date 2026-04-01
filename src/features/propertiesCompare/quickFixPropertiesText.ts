import { normalizeInput, type ParsedEnvFile } from '../envCompare';

function getEffectiveLineNumbers(parsed: ParsedEnvFile) {
  const lineNumbers = new Set<number>();

  parsed.effectiveEntries.forEach((entry) => {
    const lineCount = normalizeInput(entry.raw).split('\n').length;

    for (let offset = 0; offset < lineCount; offset += 1) {
      lineNumbers.add(entry.lineNumber + offset);
    }
  });

  return lineNumbers;
}

export function canQuickFixPropertiesText(input: string, parsed: ParsedEnvFile) {
  const normalized = normalizeInput(input);

  if (normalized.trim().length === 0) {
    return false;
  }

  return (
    parsed.duplicateMap.size > 0 ||
    parsed.issues.some((issue) => issue.code === 'malformed_line') ||
    input.includes('\r') ||
    /[ \t]+$/mu.test(normalized) ||
    /\n{3,}/u.test(normalized) ||
    normalized !== normalized.trimEnd()
  );
}

export function quickFixPropertiesText(input: string, parsed: ParsedEnvFile) {
  const normalized = normalizeInput(input);

  if (normalized.trim().length === 0) {
    return '';
  }

  const effectiveLineNumbers = getEffectiveLineNumbers(parsed);
  const keptLines = parsed.lines
    .filter((line) => {
      if (line.kind === 'comment' || line.kind === 'blank') {
        return true;
      }

      if (line.kind === 'assignment' || line.kind === 'continuation') {
        return effectiveLineNumbers.has(line.lineNumber);
      }

      return false;
    })
    .map((line) => (line.kind === 'blank' ? '' : line.raw.replace(/[ \t]+$/u, '')));

  const compactedLines: string[] = [];

  keptLines.forEach((line) => {
    if (line.trim().length === 0) {
      if (compactedLines.length === 0 || compactedLines[compactedLines.length - 1] === '') {
        return;
      }

      compactedLines.push('');
      return;
    }

    compactedLines.push(line);
  });

  while (compactedLines[compactedLines.length - 1] === '') {
    compactedLines.pop();
  }

  return compactedLines.length > 0 ? `${compactedLines.join('\n')}\n` : '';
}
