/**
 * Unit tests for core/uri-debouncer.ts -- per-URI debounce scheduling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UriDebouncer } from "../../src/core/uri-debouncer";

describe("UriDebouncer", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("fires the callback after the configured delay", () => {
        const debouncer = new UriDebouncer(100);
        const fn = vi.fn();
        debouncer.schedule("file:///a.ssl", fn);
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledOnce();
    });

    it("does not fire before the delay elapses", () => {
        const debouncer = new UriDebouncer(200);
        const fn = vi.fn();
        debouncer.schedule("file:///a.ssl", fn);
        vi.advanceTimersByTime(199);
        expect(fn).not.toHaveBeenCalled();
    });

    it("replaces a pending callback when the same key is scheduled again", () => {
        const debouncer = new UriDebouncer(100);
        const first = vi.fn();
        const second = vi.fn();
        debouncer.schedule("file:///a.ssl", first);
        vi.advanceTimersByTime(50);
        debouncer.schedule("file:///a.ssl", second);
        vi.advanceTimersByTime(100);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledOnce();
    });

    it("cancel() prevents the callback from firing and returns true", () => {
        const debouncer = new UriDebouncer(100);
        const fn = vi.fn();
        debouncer.schedule("file:///a.ssl", fn);
        const result = debouncer.cancel("file:///a.ssl");
        expect(result).toBe(true);
        vi.advanceTimersByTime(200);
        expect(fn).not.toHaveBeenCalled();
    });

    it("cancel() returns false when nothing is pending for the key", () => {
        const debouncer = new UriDebouncer(100);
        const result = debouncer.cancel("file:///a.ssl");
        expect(result).toBe(false);
    });

    it("has() returns true while pending, false after firing", () => {
        const debouncer = new UriDebouncer(100);
        debouncer.schedule("file:///a.ssl", vi.fn());
        expect(debouncer.has("file:///a.ssl")).toBe(true);
        vi.advanceTimersByTime(100);
        expect(debouncer.has("file:///a.ssl")).toBe(false);
    });

    it("has() returns false after cancel", () => {
        const debouncer = new UriDebouncer(100);
        debouncer.schedule("file:///a.ssl", vi.fn());
        debouncer.cancel("file:///a.ssl");
        expect(debouncer.has("file:///a.ssl")).toBe(false);
    });

    it("dispose() cancels all pending timers and callbacks do not fire", () => {
        const debouncer = new UriDebouncer(100);
        const fn1 = vi.fn();
        const fn2 = vi.fn();
        debouncer.schedule("file:///a.ssl", fn1);
        debouncer.schedule("file:///b.ssl", fn2);
        debouncer.dispose();
        vi.advanceTimersByTime(200);
        expect(fn1).not.toHaveBeenCalled();
        expect(fn2).not.toHaveBeenCalled();
    });

    it("multiple independent keys do not interfere with each other", () => {
        const debouncer = new UriDebouncer(100);
        const fnA = vi.fn();
        const fnB = vi.fn();
        debouncer.schedule("file:///a.ssl", fnA);
        debouncer.schedule("file:///b.ssl", fnB);
        vi.advanceTimersByTime(100);
        expect(fnA).toHaveBeenCalledOnce();
        expect(fnB).toHaveBeenCalledOnce();
    });

    it("cancelling one key does not affect other keys", () => {
        const debouncer = new UriDebouncer(100);
        const fnA = vi.fn();
        const fnB = vi.fn();
        debouncer.schedule("file:///a.ssl", fnA);
        debouncer.schedule("file:///b.ssl", fnB);
        debouncer.cancel("file:///a.ssl");
        vi.advanceTimersByTime(100);
        expect(fnA).not.toHaveBeenCalled();
        expect(fnB).toHaveBeenCalledOnce();
    });
});
