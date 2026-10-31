import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(__dirname, '../src');

/** Attributes a screen reader or tooltip will read out loud. */
const TRANSLATABLE_ATTRIBUTES = new Set(['placeholder', 'aria-label', 'title', 'alt']);

/**
 * Literals that are not copy: the brand name, symbols, and typographic glyphs. Anything
 * else with two consecutive Latin letters has to come from `t(...)` / `tt(...)`.
 */
const ALLOWED_LITERALS = new Set([
  'AgriConnect',
  'agriconnect',
  'INR',
  'en-IN',
  'UPI',
  // Faculty demo credentials printed on the login screen; they are data, not copy.
  'Demo@AgriConnect1',
]);

/** Email addresses render verbatim in every language. */
const ALLOWED_PATTERNS = [/^[\w.+-]+@[\w.-]+\.\w+$/];

const LATIN_WORD = /[A-Za-z]{2,}/;

function collectFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(full);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [full] : [];
  });
}

function isCopy(value: string): boolean {
  const text = value.trim();
  if (!text || ALLOWED_LITERALS.has(text)) return false;
  if (ALLOWED_PATTERNS.some((pattern) => pattern.test(text))) return false;
  return LATIN_WORD.test(text);
}

function findViolations(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const violations: string[] = [];
  const relative = path.relative(SRC, file).replaceAll('\\', '/');

  const report = (node: ts.Node, text: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    violations.push(`${relative}:${line + 1} ${JSON.stringify(text.trim())}`);
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && isCopy(node.text)) {
      report(node, node.text);
    }

    // `<p>{'Hardcoded'}</p>` sneaks past the JsxText check.
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      ts.isStringLiteral(node.expression) &&
      isCopy(node.expression.text) &&
      node.parent &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      report(node, node.expression.text);
    }

    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      const attribute = node.name.text;
      const initializer = node.initializer;
      if (
        TRANSLATABLE_ATTRIBUTES.has(attribute) &&
        initializer &&
        ts.isStringLiteral(initializer) &&
        isCopy(initializer.text)
      ) {
        report(node, `${attribute}=${initializer.text}`);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return violations;
}

describe('no hardcoded UI strings', () => {
  const files = collectFiles(SRC);

  it('finds component files to scan', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('has no untranslated JSX text or attributes', () => {
    const violations = files.flatMap(findViolations);
    expect(violations).toEqual([]);
  });
});
