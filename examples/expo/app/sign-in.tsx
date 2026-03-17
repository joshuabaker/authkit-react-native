import { useAuth } from "../hooks/useAuth";
import { Button, View } from "react-native";

export default function SignInScreen() {
  const { signIn } = useAuth();

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <Button title="Sign in" onPress={() => signIn()} />
      <View style={{ height: 12 }} />
      <Button
        title="Sign up"
        onPress={() => signIn({ screenHint: "sign-up" })}
      />
    </View>
  );
}
