// Things the test browser (jsdom) does not provide. Real browsers have them.
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
HTMLMediaElement.prototype.pause = vi.fn();
window.scrollTo = vi.fn();

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);

afterEach(() => {
  cleanup();
  localStorage.clear();
});
