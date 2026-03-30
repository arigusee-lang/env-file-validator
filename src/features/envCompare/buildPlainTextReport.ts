import type { CompareResult } from './types';

function formatLines(lines: number[]) {
  return `${lines.length > 1 ? 'lines' : 'line'} ${lines.join(', ')}`;
}

function section(title: string, rows: string[]) {
  if (rows.length === 0) {
    return [];
  }

  return [title, ...rows.map((row) => `- ${row}`), ''];
}

export function buildPlainTextReport(result: CompareResult): string {
  const missingRows = new Map<string, { key: string; filenames: string[] }>();
  const duplicateRows: string[] = [];
  const malformedRows: string[] = [];

  result.environments.forEach((environment) => {
    environment.missingRequiredKeys.forEach((item) => {
      const key = item.normalizedKey;
      const existing = missingRows.get(key);

      if (existing) {
        existing.filenames.push(environment.filename);
        return;
      }

      missingRows.set(key, {
        key: item.key,
        filenames: [environment.filename],
      });
    });

    environment.duplicateKeys.forEach((group) => {
      duplicateRows.push(
        `${group.key} is duplicated in ${environment.filename} (${formatLines(group.lines)})`,
      );
    });

    environment.malformedLines.forEach((issue) => {
      malformedRows.push(
        `${issue.key ?? 'Line'} is malformed in ${environment.filename} (line ${issue.lineNumber}): ${issue.message}`,
      );
    });
  });

  result.template.duplicateKeys.forEach((group) => {
    duplicateRows.push(`Template duplicates ${group.key} (${formatLines(group.lines)})`);
  });

  result.template.malformedLines.forEach((issue) => {
    malformedRows.push(
      `Template line ${issue.lineNumber}${issue.key ? ` (${issue.key})` : ''}: ${issue.message}`,
    );
  });

  const missingSummaryRows = Array.from(missingRows.values()).map(
    ({ key, filenames }) => `${key} is required in ${filenames.join(', ')}`,
  );

  const report: string[] = [];

  if (
    missingSummaryRows.length === 0 &&
    duplicateRows.length === 0 &&
    malformedRows.length === 0
  ) {
    report.push('No errors detected.');
    return report.join('\n');
  }

  report.push(
    ...section('Missing required keys', missingSummaryRows),
    ...section('Duplicate keys', duplicateRows),
    ...section('Malformed lines', malformedRows),
  );

  return report.join('\n').trim();
}
