"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LANG, getDict, type Dictionary, type Lang } from "./index";

const LangContext = createContext<Lang>(DEFAULT_LANG);

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = (): Lang => useContext(LangContext);
export const useT = (): Dictionary => getDict(useContext(LangContext));
