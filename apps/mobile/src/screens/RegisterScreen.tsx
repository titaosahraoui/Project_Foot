import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { registerSchema } from "@footconnect/shared";
import { colors, gradients, spacing } from "@footconnect/ui";
import { useAuth } from "../lib/auth-context";
import { Button, Input, Logo, Text } from "../components/ui";
import type { AuthStackParamList } from "../navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    const parsed = registerSchema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      setError("Check your name, email, and a password of 8+ characters.");
      return;
    }
    setSubmitting(true);
    try {
      await register(parsed.data);
    } catch {
      setError("Could not register. The email may already be in use.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LinearGradient colors={gradients.hero as unknown as readonly [string, string]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.container}>
            <Logo size={56} />
            <Text variant="displayM" style={styles.title}>
              JOIN THE{"\n"}LADDER
            </Text>
            <Text variant="bodySmall" style={styles.sub}>
              Create your player profile.
            </Text>

            <View style={styles.form}>
              <Input label="Display name" placeholder="Your name" value={displayName} onChangeText={setDisplayName} />
              <Input
                label="Email"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Input label="Password" placeholder="8+ characters" secureTextEntry value={password} onChangeText={setPassword} />
              {error ? <Text color={colors.danger}>{error}</Text> : null}
              <Button label="Create account" loading={submitting} onPress={onSubmit} size="lg" />
            </View>

            <Pressable onPress={() => navigation.navigate("Login")} style={styles.link}>
              <Text variant="bodySmall" color={colors.textSecondary}>
                Already have an account? <Text color={colors.brand}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.gutter, gap: spacing.sm },
  title: { marginTop: spacing.lg },
  sub: { marginBottom: spacing.lg },
  form: { gap: spacing.md, marginBottom: spacing.lg },
  link: { alignItems: "center" },
});
