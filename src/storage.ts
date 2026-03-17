import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export function createStorage(prefix: string) {
  const tokensKey = `${prefix}.tokens`;
  const metaKey = `${prefix}.meta`;

  return {
    async readTokens(): Promise<string | null> {
      return SecureStore.getItemAsync(tokensKey);
    },

    async writeTokens(value: string): Promise<void> {
      await SecureStore.setItemAsync(tokensKey, value);
    },

    async readMeta(): Promise<string | null> {
      return AsyncStorage.getItem(metaKey);
    },

    async writeMeta(value: string): Promise<void> {
      await AsyncStorage.setItem(metaKey, value);
    },

    async clear(): Promise<void> {
      await Promise.all([
        SecureStore.deleteItemAsync(tokensKey),
        AsyncStorage.removeItem(metaKey),
      ]);
    },
  };
}
