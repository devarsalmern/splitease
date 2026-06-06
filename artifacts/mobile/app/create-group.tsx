import { useCreateGroup, useInviteToGroup } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

export default function CreateGroupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingInvites, setPendingInvites] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [createdGroupId, setCreatedGroupId] = useState<number | null>(null);

  const createGroup = useCreateGroup({
    mutation: {
      onSuccess: async (data) => {
        setCreatedGroupId(data.id);
        queryClient.invalidateQueries();
        router.back();
        router.push(`/group/${data.id}`);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Failed to create group";
        setError(msg);
      },
    },
  });

  const inviteToGroup = useInviteToGroup();

  const addInviteEmail = () => {
    if (!inviteEmail.trim()) return;
    const email = inviteEmail.trim().toLowerCase();
    if (pendingInvites.includes(email)) {
      setInviteEmail("");
      return;
    }
    setPendingInvites((prev) => [...prev, email]);
    setInviteEmail("");
  };

  const removeEmail = (email: string) => {
    setPendingInvites((prev) => prev.filter((e) => e !== email));
  };

  const handleCreate = async () => {
    setError("");
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    createGroup.mutate({
      data: {
        name: name.trim(),
        description: description.trim() || undefined,
      },
    });
  };

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={s.header}>
        <Pressable style={s.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.title}>New Group</Text>
        <Pressable
          style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={handleCreate}
          disabled={createGroup.isPending}
        >
          {createGroup.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={s.saveBtnText}>Create</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.iconPlaceholder}>
          <Text style={s.iconText}>{name ? name.charAt(0).toUpperCase() : "G"}</Text>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Group Name</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Roommates, Trip to Paris…"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Description (optional)</Text>
          <TextInput
            style={[s.input, s.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this group for?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Invite People (optional)</Text>
          <View style={s.inviteRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="Email address"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              onSubmitEditing={addInviteEmail}
              returnKeyType="done"
            />
            <Pressable
              style={({ pressed }) => [s.addEmailBtn, pressed && { opacity: 0.8 }]}
              onPress={addInviteEmail}
            >
              <Feather name="plus" size={20} color={colors.primaryForeground} />
            </Pressable>
          </View>

          {pendingInvites.length > 0 && (
            <View style={s.inviteList}>
              {pendingInvites.map((email) => (
                <View key={email} style={s.inviteChip}>
                  <Text style={s.inviteEmail}>{email}</Text>
                  <Pressable onPress={() => removeEmail(email)}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Text style={s.inviteNote}>
            Invites will be sent after the group is created
          </Text>
        </View>

        {!!error && <Text style={s.errorText}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    saveBtnText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    content: { padding: 20, gap: 20 },
    iconPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
    },
    iconText: {
      fontSize: 32,
      fontFamily: "Inter_700Bold",
      color: colors.primaryForeground,
    },
    field: { gap: 8 },
    label: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      backgroundColor: colors.card,
    },
    multilineInput: {
      height: 80,
      textAlignVertical: "top",
    },
    inviteRow: { flexDirection: "row", gap: 10 },
    addEmailBtn: {
      backgroundColor: colors.primary,
      width: 50,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    inviteList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    inviteChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.secondary,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    inviteEmail: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.primary,
    },
    inviteNote: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    errorText: {
      color: colors.destructive,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      textAlign: "center",
    },
  });
