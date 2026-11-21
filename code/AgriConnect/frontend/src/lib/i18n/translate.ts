import type { Locale } from './locales';
import { DEFAULT_LOCALE } from './locales';
import type { MessageTree } from './messages/en';
import { messagesByLocale } from './messages';

type Primitive = string;

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Primitive
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? Leaves<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type MessageKey = Leaves<MessageTree>;

function readPath(tree: MessageTree, path: string): string | undefined {
  const parts = path.split('.');
  let cursor: unknown = tree;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === 'string' ? cursor : undefined;
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const primary = readPath(messagesByLocale[locale], key);
  const fallback = locale === DEFAULT_LOCALE ? undefined : readPath(messagesByLocale.en, key);
  let text = primary ?? fallback ?? key;

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }

  return text;
}

export function collectMessageKeys(tree: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') keys.push(path);
    else if (value && typeof value === 'object') {
      keys.push(...collectMessageKeys(value as Record<string, unknown>, path));
    }
  }
  return keys.sort();
}
