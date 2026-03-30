import type { ParsedEnvFile } from './types';

export function generateTemplate(parsedEnv: ParsedEnvFile): string {
  const seen = new Set<string>();
  const lines: string[] = [];

  parsedEnv.validEntries.forEach((entry) => {
    if (seen.has(entry.normalizedKey)) {
      return;
    }

    seen.add(entry.normalizedKey);
    lines.push(`${entry.key}=`);
  });

  return lines.join('\n');
}
