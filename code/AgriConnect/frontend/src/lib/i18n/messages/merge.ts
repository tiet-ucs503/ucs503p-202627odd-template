import { en, type MessageTree } from './en';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge<T extends Record<string, unknown>>(base: T, patch: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue;
    const current = out[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      out[key] = deepMerge(current, value as DeepPartial<typeof current>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/** Fill every English key; override only the strings provided for this locale. */
export function withEnglishFallback(patch: DeepPartial<MessageTree>): MessageTree {
  return deepMerge(en as unknown as Record<string, unknown>, patch) as MessageTree;
}
