import { createAuthStore } from "authkit-react-native";
import { useStore } from "zustand";

const authStore = createAuthStore({
  authorizationEndpoint: `${process.env.EXPO_PUBLIC_API_URL!}/v1/auth/authorize`,
  tokenEndpoint: `${process.env.EXPO_PUBLIC_API_URL!}/v1/auth/token`,
  revocationEndpoint: `${process.env.EXPO_PUBLIC_API_URL!}/v1/auth/revoke`,
});

export function useAuth() {
  return useStore(authStore);
}
