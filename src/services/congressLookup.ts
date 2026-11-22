/**
 * Live lookup of current U.S. senators and House members (incl. non-voting
 * delegates) from the public-domain @unitedstates/congress-legislators dataset.
 * Only a public file is downloaded; nothing about the user is sent.
 * The compact result is cached in localStorage for 24 hours.
 */
import { t } from '../i18n';

const SOURCE_URL =
  'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const CACHE_KEY = 'civics128:congress:v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface Representative {
  district: number; // 0 = at-large / delegate
  name: string;
  isDelegate: boolean;
}

export interface StateDelegation {
  senators: string[];
  representatives: Representative[];
}

export type CongressIndex = Record<string, StateDelegation>;

interface RawLegislator {
  name: { first: string; last: string; nickname?: string; suffix?: string; official_full?: string };
  terms: { type: 'sen' | 'rep'; state: string; district?: number }[];
}

const NON_VOTING = new Set(['DC', 'PR', 'GU', 'VI', 'MP', 'AS']);

let memoryCache: CongressIndex | null = null;
let inFlight: Promise<CongressIndex> | null = null;

/** Official full name without commas (answers are comma-separated in settings). */
function displayName(n: RawLegislator['name']): string {
  const full = n.official_full || [n.nickname || n.first, n.last, n.suffix].filter(Boolean).join(' ');
  return full.replace(/\s*,\s*/g, ' ').trim();
}

function buildIndex(raw: RawLegislator[]): CongressIndex {
  const index: CongressIndex = {};
  for (const person of raw) {
    const term = person.terms[person.terms.length - 1];
    if (!term) continue;
    const entry = (index[term.state] ??= { senators: [], representatives: [] });
    const name = displayName(person.name);
    if (term.type === 'sen') {
      entry.senators.push(name);
    } else {
      entry.representatives.push({
        district: term.district ?? 0,
        name,
        isDelegate: NON_VOTING.has(term.state),
      });
    }
  }
  for (const entry of Object.values(index)) {
    entry.representatives.sort((a, b) => a.district - b.district);
  }
  return index;
}

function readCache(): CongressIndex | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; index: CongressIndex };
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.index;
  } catch {
    return null;
  }
}

function writeCache(index: CongressIndex): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), index }));
  } catch {
    // Storage unavailable; memory cache still works for this visit.
  }
}

export function loadCongressIndex(): Promise<CongressIndex> {
  if (memoryCache) return Promise.resolve(memoryCache);
  const cached = readCache();
  if (cached) {
    memoryCache = cached;
    return Promise.resolve(cached);
  }
  inFlight ??= fetch(SOURCE_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<RawLegislator[]>;
    })
    .then((raw) => {
      const index = buildIndex(raw);
      memoryCache = index;
      writeCache(index);
      return index;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function districtLabel(rep: Representative): string {
  if (rep.isDelegate) return t('district.delegate');
  return rep.district === 0 ? t('district.atLarge') : t('district.number', { n: rep.district });
}
