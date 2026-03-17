import { useAuth } from "../hooks/useAuth";
import { Alert, Button, Text, View } from "react-native";

export default function PrivateScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert("Are you sure you want to sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 18, marginBottom: 24 }}>
        Logged in as {user?.email}
      </Text>
      <Button title="Sign out" onPress={handleSignOut} />
    </View>
  );
}
