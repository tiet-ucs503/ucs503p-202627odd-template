import { describe, it, expect } from "vitest";
import { RollingBuffer } from "@/analysis/RollingBuffer.js";

describe("RollingBuffer", () => {
  it("throws for a non-positive-integer capacity", () => {
    expect(() => new RollingBuffer(0)).toThrow();
    expect(() => new RollingBuffer(-1)).toThrow();
    expect(() => new RollingBuffer(1.5)).toThrow();
  });

  it("starts empty", () => {
    const buf = new RollingBuffer(3);
    expect(buf.size()).toBe(0);
    expect(buf.toArray()).toEqual([]);
  });

  it("accumulates up to capacity without evicting", () => {
    const buf = new RollingBuffer(3);
    buf.push(1);
    buf.push(2);
    expect(buf.size()).toBe(2);
    expect(buf.toArray()).toEqual([1, 2]);
  });

  it("evicts the oldest item once over capacity, preserving order", () => {
    const buf = new RollingBuffer(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4); // evicts 1
    expect(buf.size()).toBe(3);
    expect(buf.toArray()).toEqual([2, 3, 4]);

    buf.push(5); // evicts 2
    expect(buf.toArray()).toEqual([3, 4, 5]);
  });

  it("clear() empties the buffer", () => {
    const buf = new RollingBuffer(2);
    buf.push("a");
    buf.push("b");
    buf.clear();
    expect(buf.size()).toBe(0);
    expect(buf.toArray()).toEqual([]);
  });

  it("toArray() returns a snapshot, not a live reference", () => {
    const buf = new RollingBuffer(2);
    buf.push(1);
    const snapshot = buf.toArray();
    buf.push(2);
    expect(snapshot).toEqual([1]);
  });
});
