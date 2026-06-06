import { useGetProfile, useUpdateProfile, useChangePassword } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut, user, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useGetProfile();
  const [name, setName] = useState(user?.name ?? "");
  const [editing, setEditing] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdError, setPwdError] = useState("");

  const updateProfile = useUpdateProfile({
    mutation: {
      onSuccess: (data) => {
        updateUser({ userId: user!.userId, email: data.email, name: data.name });
        setEditing(false);
        queryClient.invalidateQueries();
      },
    },
  });

  const changePassword = useChangePassword({
    mutation: {
      onSuccess: () => {
        setCurrentPwd("");
        setNewPwd("");
        setPwdError("");
        Alert.alert("Success", "Password changed successfully");
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Failed to change password";
        setPwdError(msg);
      },
    },
  });

  const s = styles(colors);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          queryClient.clear();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[s.container, { paddingTop: insets.top, justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={[
        s.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={s.title}>Profile</Text>

      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {(profile?.name ?? user?.name ?? "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={s.profileName}>{profile?.name ?? user?.name}</Text>
        <Text style={s.profileEmail}>{profile?.email ?? user?.email}</Text>
      </View>

      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Personal Info</Text>
          <Pressable onPress={() => setEditing(!editing)}>
            <Feather name={editing ? "x" : "edit-2"} size={18} color={colors.primary} />
          </Pressable>
        </View>

        {editing ? (
          <View style={s.editForm}>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
            <Pressable
              style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.8 }]}
              onPress={() => updateProfile.mutate({ data: { name } })}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={s.saveBtnText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={s.infoRow}>
            <Feather name="user" size={16} color={colors.mutedForeground} />
            <Text style={s.infoText}>{profile?.name ?? user?.name}</Text>
          </View>
        )}

        <View style={s.infoRow}>
          <Feather name="mail" size={16} color={colors.mutedForeground} />
          <Text style={s.infoText}>{profile?.email ?? user?.email}</Text>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Change Password</Text>
        <View style={s.editForm}>
          <TextInput
            style={s.input}
            value={currentPwd}
            onChangeText={setCurrentPwd}
            placeholder="Current password"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
          />
          <TextInput
            style={s.input}
            value={newPwd}
            onChangeText={setNewPwd}
            placeholder="New password (min. 8 characters)"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
          />
          {!!pwdError && <Text style={s.errorText}>{pwdError}</Text>}
          <Pressable
            style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.8 }]}
            onPress={() => {
              if (!currentPwd || !newPwd) return;
              changePassword.mutate({ data: { currentPassword: currentPwd, newPassword: newPwd } });
            }}
            disabled={changePassword.isPending}
          >
            {changePassword.isPending ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={s.saveBtnText}>Update Password</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [s.signOutBtn, pressed && { opacity: 0.8 }]}
        onPress={handleSignOut}
      >
        <Feather name="log-out" size={18} color={colors.destructive} />
        <Text style={s.signOutText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, gap: 24 },
    title: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    avatarSection: { alignItems: "center", gap: 8 },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 32,
      fontFamily: "Inter_700Bold",
      color: colors.primaryForeground,
    },
    profileName: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    profileEmail: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    infoText: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    editForm: { gap: 10 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      backgroundColor: colors.background,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 13,
      alignItems: "center",
    },
    saveBtnText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
    },
    signOutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: colors.destructive + "40",
    },
    signOutText: {
      color: colors.destructive,
      fontFamily: "Inter_600SemiBold",
      fontSize: 16,
    },
  });
