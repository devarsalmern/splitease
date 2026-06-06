import { useLogin } from "@workspace/api-client-react";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = useLogin({
    mutation: {
      onSuccess: async (data) => {
        await signIn(data.token, {
          userId: data.user.id,
          email: data.user.email,
          name: data.user.name,
        });
        router.replace("/(tabs)");
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ?? "Login failed";
        setError(msg);
      },
    },
  });

  const handleLogin = () => {
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    loginMutation.mutate({ data: { email, password } });
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.inner}>
        <View style={s.header}>
          <Text style={s.logo}>SplitEase</Text>
          <Text style={s.subtitle}>Split expenses with friends</Text>
        </View>

        <View style={s.form}>
          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {!!error && <Text style={s.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [s.button, pressed && s.buttonPressed]}
            onPress={handleLogin}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={s.buttonText}>Sign In</Text>
            )}
          </Pressable>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Text style={s.link}>Sign Up</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    inner: {
      flex: 1,
      paddingHorizontal: 28,
      justifyContent: "center",
      gap: 32,
    },
    header: { alignItems: "center", gap: 8 },
    logo: {
      fontSize: 36,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
      letterSpacing: -1,
    },
    subtitle: {
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    form: { gap: 12 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    error: {
      color: colors.destructive,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 4,
    },
    buttonPressed: { opacity: 0.85 },
    buttonText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
    footer: { flexDirection: "row", justifyContent: "center" },
    footerText: {
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
    },
    link: {
      color: colors.primary,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
  });
