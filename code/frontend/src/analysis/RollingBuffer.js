// Fixed-capacity rolling window buffer.
export class RollingBuffer {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`RollingBuffer: capacity must be a positive integer, got ${capacity}`);
    }
    this.capacity = capacity;
    this._items = [];
  }

  // Appends item, evicting oldest if capacity exceeded.
  push(value) {
    this._items.push(value);
    if (this._items.length > this.capacity) {
      this._items.shift();
    }
  }

  // Returns shallow copy of items oldest-first.
  toArray() {
    return this._items.slice();
  }

  size() {
    return this._items.length;
  }

  clear() {
    this._items = [];
  }
}
