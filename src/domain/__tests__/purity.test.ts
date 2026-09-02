import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Enforces the contract from spec §7.4: `src/domain` is pure TypeScript.
 *
 * This is not style policing. The entire progression system has to be
 * replayable over the event log — that is what makes import work, what lets
 * the level curve be retuned years later without corrupting history, and what
 * keeps these tests fast enough to run on every save. One `import { Platform }
 * from 'react-native'` in a reducer quietly ends all of that, and it would be
 * discovered months later during an import bug.
 */

const DOMAIN_ROOT = join(__dirname, '..');

const FORBIDDEN_IMPORTS = [
  'react',
  'react-native',
  'react-dom',
  'expo',
  'expo-sqlite',
  'drizzle-orm',
  'zustand',
  '@/data',
  '@/ui',
  'node:fs',
  'node:path',
];

/** Ambient state that would make a reducer non-deterministic on replay. */
const FORBIDDEN_GLOBALS: readonly (readonly [pattern: RegExp, why: string])[] = [
  [/\bDate\.now\s*\(/, 'reads the clock; take a Date or timestamp as an argument instead'],
  [/\bnew Date\s*\(\s*\)/, 'reads the clock; take a Date as an argument instead'],
  [/\bMath\.random\s*\(/, 'non-deterministic; pass a seeded RNG in'],
  [/\bglobalThis\b/, 'reaches for ambient state'],
  [/\bprocess\.env\b/, 'reads the environment'],
];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...sourceFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

const files = sourceFiles(DOMAIN_ROOT);

describe('domain purity', () => {
  it('finds the domain source files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((f) => [relative(DOMAIN_ROOT, f), f]))(
    '%s imports nothing outside the domain',
    (_label, file) => {
      const source = readFileSync(file, 'utf8');
      const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);

      for (const specifier of imports) {
        expect(specifier.startsWith('.'), `"${specifier}" is not a relative import`).toBe(true);
        expect(FORBIDDEN_IMPORTS).not.toContain(specifier);
      }
    },
  );

  it.each(files.map((f) => [relative(DOMAIN_ROOT, f), f]))(
    '%s reads no ambient state',
    (_label, file) => {
      const source = readFileSync(file, 'utf8');
      for (const [pattern, why] of FORBIDDEN_GLOBALS) {
        expect(pattern.test(source), `${pattern} — ${why}`).toBe(false);
      }
    },
  );
});
