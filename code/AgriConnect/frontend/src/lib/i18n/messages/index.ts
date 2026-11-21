import { en, type MessageTree } from './en';
import { hi } from './hi';
import { pa } from './pa';
import { bn } from './bn';
import { ta } from './ta';
import { te } from './te';
import { mr } from './mr';
import { gu } from './gu';
import { kn } from './kn';
import { ml } from './ml';
import { or } from './or';
import { assamese } from './as';
import { ur } from './ur';
import type { Locale } from '../locales';
import { bidsMessagesByLocale } from './bids-messages';
import { deepMerge, type DeepPartial } from './merge';

function withBids(locale: string, base: MessageTree): MessageTree {
  const patch = bidsMessagesByLocale[locale];
  return patch
    ? (deepMerge(base as unknown as Record<string, unknown>, patch as DeepPartial<Record<string, unknown>>) as MessageTree)
    : base;
}

export const messagesByLocale: Record<Locale, MessageTree> = {
  en,
  hi,
  pa,
  bn: withBids('bn', bn),
  ta: withBids('ta', ta),
  te: withBids('te', te),
  mr: withBids('mr', mr),
  gu: withBids('gu', gu),
  kn: withBids('kn', kn),
  ml: withBids('ml', ml),
  or: withBids('or', or),
  as: withBids('as', assamese),
  ur: withBids('ur', ur),
};
