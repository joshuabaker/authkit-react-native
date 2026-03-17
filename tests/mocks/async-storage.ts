import { vi } from "vitest";

const store = new Map<string, string>();

export default {
  getItem: vi.fn(async (key: string) => {
    return store.get(key) ?? null;
  }),

  setItem: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),

  removeItem: vi.fn(async (key: string) => {
    store.delete(key);
  }),

  __clear() {
    store.clear();
  },
};
