"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Undo/redo history with automatic grouping: rapid successive changes (slider drags)
 * become a single history entry once the user pauses for `groupMs`.
 */
export function useHistory<S>(initial: S | (() => S), groupMs = 600) {
  const [state, setStateRaw] = useState<S>(initial);
  const stateRef = useRef(state);
  const past = useRef<S[]>([]);
  const future = useRef<S[]>([]);
  const pending = useRef<S | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // render-safe snapshot of the history metadata (refs must not be read during render)
  const [meta, setMeta] = useState<{ past: S[]; canUndo: boolean; canRedo: boolean }>({ past: [], canUndo: false, canRedo: false });
  const bump = () =>
    setMeta({ past: past.current.slice(), canUndo: past.current.length > 0 || pending.current !== null, canRedo: future.current.length > 0 });

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current !== null) {
      past.current.push(pending.current);
      if (past.current.length > 100) past.current.shift();
      pending.current = null;
      future.current = [];
      bump();
    }
  }, []);

  const set = useCallback(
    (next: S | ((prev: S) => S)) => {
      const value = typeof next === "function" ? (next as (prev: S) => S)(stateRef.current) : next;
      if (value === stateRef.current) return;
      if (pending.current === null) pending.current = stateRef.current;
      stateRef.current = value;
      setStateRaw(value);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, groupMs);
      setMeta((m) => (m.canUndo ? m : { ...m, canUndo: true }));
    },
    [flush, groupMs],
  );

  const undo = useCallback(() => {
    flush();
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(stateRef.current);
    stateRef.current = prev;
    setStateRaw(prev);
    bump();
  }, [flush]);

  const redo = useCallback(() => {
    flush();
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(stateRef.current);
    stateRef.current = next;
    setStateRaw(next);
    bump();
  }, [flush]);

  /** Jump back to a past entry (index into `past`); the current state is kept in history. */
  const jumpTo = useCallback(
    (index: number) => {
      flush();
      const target = past.current[index];
      if (target === undefined) return;
      set(target);
      flush();
    },
    [flush, set],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return {
    state,
    set,
    undo,
    redo,
    jumpTo,
    canUndo: meta.canUndo,
    canRedo: meta.canRedo,
    past: meta.past,
  };
}
