import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIp, isRateLimited } from "./rate-limit";

describe("isRateLimited", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 20; i++) {
      expect(isRateLimited(key)).toBe(false);
    }
  });

  it("blocks requests once the limit is exceeded", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 20; i++) {
      isRateLimited(key);
    }
    expect(isRateLimited(key)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < 20; i++) {
      isRateLimited(keyA);
    }
    expect(isRateLimited(keyA)).toBe(true);
    expect(isRateLimited(keyB)).toBe(false);
  });

  it("unblocks a key again once its window passes", () => {
    vi.useFakeTimers();
    const key = `test-window-${Math.random()}`;

    for (let i = 0; i < 20; i++) {
      isRateLimited(key);
    }
    expect(isRateLimited(key)).toBe(true);

    vi.advanceTimersByTime(60_001);

    expect(isRateLimited(key)).toBe(false);
  });
});

describe("getClientIp", () => {
  it("prefers x-real-ip when present", () => {
    const headers = new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 1.2.3.4" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("falls back to the last x-forwarded-for entry, not the first", () => {
    const headers = new Headers({ "x-forwarded-for": "spoofed-by-client, 5.6.7.8" });
    expect(getClientIp(headers)).toBe("5.6.7.8");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    const headers = new Headers();
    expect(getClientIp(headers)).toBe("unknown");
  });
});
