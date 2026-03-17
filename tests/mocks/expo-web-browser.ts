import { vi } from "vitest";

export const maybeCompleteAuthSession = vi.fn();
export const warmUpAsync = vi.fn().mockResolvedValue(undefined);
