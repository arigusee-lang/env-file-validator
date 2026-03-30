export function normalizeInput(input: string): string {
  return input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}
