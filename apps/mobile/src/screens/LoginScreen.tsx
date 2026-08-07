import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { loginSchema } from "@footconnect/shared";
import { colors, gradients, spacing } from "@footconnect/ui";
import { useAuth } from "../lib/auth-context";
import { Button, Input, Logo, Text } from "../components/ui";
import type { AuthStackParamList } from "../navigation";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError("Enter a valid email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(parsed.data);
    } catch {
      setError("Invalid credentials.");
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
              WELCOME{"\n"}BACK
            </Text>
            <Text variant="bodySmall" style={styles.sub}>
              Book. Play. Rank up.
            </Text>

            <View style={styles.form}>
              <Input
                label="Email"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Input label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
              {error ? <Text color={colors.danger}>{error}</Text> : null}
              <Button label="Sign in" loading={submitting} onPress={onSubmit} size="lg" />
            </View>

            <Pressable onPress={() => navigation.navigate("Register")} style={styles.link}>
              <Text variant="bodySmall" color={colors.textSecondary}>
                No account? <Text color={colors.brand}>Create one</Text>
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
