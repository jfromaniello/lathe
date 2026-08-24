import { en, es, type Dictionary } from "./dictionaries";

export type Lang = "en" | "es";
export const LANGS: Lang[] = ["en", "es"];
export const DEFAULT_LANG: Lang = "en";

const DICTS: Record<Lang, Dictionary> = { en, es };

export const isLang = (s: string | null | undefined): s is Lang => LANGS.includes(s as Lang);
export const getDict = (lang: Lang): Dictionary => DICTS[lang];
export type { Dictionary };

/** Path prefix for a language: the default language lives at the root, others under /<lang>. */
export const langPrefix = (lang: Lang) => (lang === DEFAULT_LANG ? "" : `/${lang}`);

/** URL for the same design in another language, keeping the query string. */
export const langHref = (lang: Lang, qs: string) => `${langPrefix(lang) || "/"}${qs ? `?${qs}` : ""}`;
