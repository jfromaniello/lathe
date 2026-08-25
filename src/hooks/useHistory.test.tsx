// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistory } from "./useHistory";

describe("useHistory", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("groups rapid changes into one undo step", () => {
    const { result } = renderHook(() => useHistory(0, 500));
    act(() => {
      result.current.set(1);
      result.current.set(2);
      result.current.set(3);
    });
    expect(result.current.state).toBe(3);
    act(() => void vi.advanceTimersByTime(600));
    expect(result.current.past).toEqual([0]);
    act(() => result.current.undo());
    expect(result.current.state).toBe(0);
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.state).toBe(3);
  });

  it("undo flushes a pending group immediately", () => {
    const { result } = renderHook(() => useHistory("a", 500));
    act(() => result.current.set("b"));
    act(() => result.current.undo());
    expect(result.current.state).toBe("a");
  });

  it("a new change after undo drops the redo stack", () => {
    const { result } = renderHook(() => useHistory(0, 100));
    act(() => result.current.set(1));
    act(() => void vi.advanceTimersByTime(200));
    act(() => result.current.undo());
    act(() => result.current.set(5));
    act(() => void vi.advanceTimersByTime(200));
    expect(result.current.canRedo).toBe(false);
    expect(result.current.past).toEqual([0]);
  });

  it("jumpTo restores a past entry and keeps the current one in history", () => {
    const { result } = renderHook(() => useHistory(0, 100));
    for (const v of [1, 2, 3]) {
      act(() => result.current.set(v));
      act(() => void vi.advanceTimersByTime(200));
    }
    expect(result.current.past).toEqual([0, 1, 2]);
    act(() => result.current.jumpTo(1));
    expect(result.current.state).toBe(1);
    expect(result.current.past).toEqual([0, 1, 2, 3]);
  });
});
