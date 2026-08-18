import { uk } from './uk';
import { en } from './en';

export type Locale = 'uk' | 'en';

// Same shape as `uk`, but with every leaf widened to `string` — otherwise
// `en` would be required to literally equal `uk`'s strings (from `as const`).
export type Strings<T> = { [K in keyof T]: T[K] extends string ? string : Strings<T[K]> };

const dictionaries: Record<Locale, Strings<typeof uk>> = { uk, en };

const STORAGE_KEY = 'fcm-manager-locale';

function readStoredLocale(): Locale {
	const stored = localStorage.getItem(STORAGE_KEY);
	return stored === 'en' ? 'en' : 'uk'; // Ukrainian is the default for anything else, including unset.
}

let locale: Locale = readStoredLocale();
const listeners = new Set<() => void>();

export function getLocale(): Locale {
	return locale;
}

export function setLocale(next: Locale) {
	if (next === locale) return;
	locale = next;
	localStorage.setItem(STORAGE_KEY, next);
	listeners.forEach((fn) => fn());
}

export function onLocaleChange(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function lookup(path: string): string {
	const parts = path.split('.');
	let node: any = dictionaries[locale];
	for (const p of parts) node = node?.[p];
	if (typeof node === 'string') return node;
	// Fall back to Ukrainian, then the raw key, rather than showing "undefined".
	let fallback: any = dictionaries.uk;
	for (const p of parts) fallback = fallback?.[p];
	return typeof fallback === 'string' ? fallback : path;
}

export function t(path: string, vars?: Record<string, string | number>): string {
	let s = lookup(path);
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			s = s.replaceAll(`{${k}}`, String(v));
		}
	}
	return s;
}

/** Ukrainian has three plural forms; English has two. Used for "N device(s)". */
export function deviceWord(n: number): string {
	if (locale === 'en') return n === 1 ? 'device' : 'devices';
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod10 === 1 && mod100 !== 11) return 'пристрій';
	if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'пристрої';
	return 'пристроїв';
}

const knownErrors: Record<string, string> = {
	'Not connected to FMC — set a token first.': 'errors.notConnected',
	'No FMC domain configured — set it first.': 'errors.noDomain',
	'Refusing to delete: this object was not created by this app.': 'errors.refusingDelete',
	'Refusing to modify: this object was not created by this app.': 'errors.refusingModify',
	'FMC did not return X-auth-access-token in the response headers.': 'errors.noTokenHeader',
};

/** Translates our own known guard/error strings; passes through anything else (e.g. raw FMC API errors) untouched. */
export function translateError(message: string): string {
	const key = knownErrors[message];
	return key ? t(key) : message;
}
