/**
 * Unified 1936 European playable nations table (31 sovereign European states).
 */
import { FEATURED_NATIONS_1936, type NationStartProfile } from './nations1936Core';
import { MINOR_NATIONS_1936 } from './nations1936Minors';

export * from './nations1936Core';

export const ALL_PLAYABLE_NATIONS_1936: readonly NationStartProfile[] = [
  ...FEATURED_NATIONS_1936,
  ...MINOR_NATIONS_1936,
];

export const PLAYABLE_TAG_LIST: readonly string[] = ALL_PLAYABLE_NATIONS_1936.map((n) => n.tag);

const PROFILE_MAP = new Map<string, NationStartProfile>(
  ALL_PLAYABLE_NATIONS_1936.map((n) => [n.tag, n]),
);

export function getNationStartProfile(tag: string): NationStartProfile | null {
  return PROFILE_MAP.get(tag) ?? null;
}

export function isPlayableTag(tag: string): boolean {
  return PROFILE_MAP.has(tag);
}
