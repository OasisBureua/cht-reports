import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BUILTIN_HTML_TEMPLATE, BUILTIN_SYSTEM_PROMPT } from './builtin';

const V1 = join(__dirname, '../../../templates/executive_summary/1.0.0');

describe('built-in template', () => {
  it('matches the published executive_summary 1.0.0 prompt', () => {
    expect(readFileSync(join(V1, 'system-prompt.md'), 'utf-8').trim()).toBe(BUILTIN_SYSTEM_PROMPT);
  });

  it('matches the published executive_summary 1.0.0 HTML', () => {
    expect(readFileSync(join(V1, 'template.html'), 'utf-8')).toBe(BUILTIN_HTML_TEMPLATE);
  });
});
