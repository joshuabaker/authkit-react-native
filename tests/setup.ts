import { vi } from "vitest";

vi.mock("expo-web-browser", () => import("./mocks/expo-web-browser"));
vi.mock("expo-auth-session", () => import("./mocks/expo-auth-session"));
vi.mock("expo-secure-store", () => import("./mocks/expo-secure-store"));
vi.mock("@react-native-async-storage/async-storage", () =>
  import("./mocks/async-storage"),
);
