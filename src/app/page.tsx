"use client";

import dynamic from "next/dynamic";

// The whole app is client-only: it depends on WebGL and reads its state from the URL.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-sm text-neutral-500">Cargando…</div>
  ),
});

export default function Page() {
  return <App />;
}
