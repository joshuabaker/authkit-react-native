import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  external: [
    "expo-auth-session",
    "expo-secure-store",
    "expo-web-browser",
    "@react-native-async-storage/async-storage",
    "react",
    "zustand",
  ],
});
