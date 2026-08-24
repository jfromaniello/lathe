import { NextResponse, type NextRequest } from "next/server";

// Keep in sync with src/i18n (proxy must not import app modules)
const LANGS = ["en", "es"];
const DEFAULT_LANG = "en";

/** Highest-priority language from Accept-Language that we support, or the default. */
function preferredLang(header: string | null): string {
  if (!header) return DEFAULT_LANG;
  const ranked = header
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1, i };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  return ranked.find((x) => LANGS.includes(x.lang))?.lang ?? DEFAULT_LANG;
}

// Only the root is language-neutral: a browser that prefers Spanish is sent to /es (query string kept).
// Explicit /es and /en URLs (shared links) are left alone.
export function proxy(request: NextRequest) {
  const lang = preferredLang(request.headers.get("accept-language"));
  if (lang === DEFAULT_LANG) return;
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: "/",
};
