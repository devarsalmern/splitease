import { useCreateSettlement, useGetGroupBalances, useGetGroup } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
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

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function formatCurrency(amount: number | string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Math.abs(Number(amount)));
}

export default function SettleUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const gid = Number(groupId);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: group } = useGetGroup(gid);
  const { data: balances, isLoading } = useGetGroupBalances(gid);
  const members = group?.members ?? [];

  const [toUserId, setToUserId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const createSettlement = useCreateSettlement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.back();
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Failed to record settlement";
        setError(msg);
      },
    },
  });

  const handleSubmit = () => {
    setError("");
    if (!toUserId) { setError("Select who you're settling with"); return; }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError("Enter a valid amount"); return; }

    createSettlement.mutate({
      groupId: gid,
      data: {
        paidTo: toUserId,
        amount: amt,
        note: note.trim() || undefined,
      },
    });
  };

  type Debt = { fromUserId: number; fromUserName: string; toUserId: number; toUserName: string; amount: number };
  const myDebts: Debt[] = (balances?.simplifiedDebts ?? []).filter(
    (b: Debt) => b.fromUserId === user?.userId
  );

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
        <Text style={s.title}>Settle Up</Text>
        <Pressable
          style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={handleSubmit}
          disabled={createSettlement.isPending}
        >
          {createSettlement.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={s.saveBtnText}>Record</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : myDebts.length > 0 ? (
          <View style={s.debtCard}>
            <Text style={s.debtLabel}>You owe</Text>
            {myDebts.map((d) => (
              <View key={`${d.fromUserId}-${d.toUserId}`} style={s.debtRow}>
                <Text style={s.debtName}>{d.toUserName}</Text>
                <Text style={[s.debtAmount, { color: colors.negative }]}>
                  {formatCurrency(d.amount)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.settledCard}>
            <Feather name="check-circle" size={40} color={colors.positive} />
            <Text style={s.settledText}>You're all settled up in this group!</Text>
          </View>
        )}

        <View style={s.amountCard}>
          <Text style={s.currencySymbol}>$</Text>
          <TextInput
            style={s.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardType="decimal-pad"
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Pay to</Text>
          <View style={s.memberGrid}>
            {members
              .filter((m) => m.id !== user?.userId)
              .map((m) => (
                <Pressable
                  key={m.id}
                  style={[s.memberChip, toUserId === m.id && s.memberChipActive]}
                  onPress={() => {
                    setToUserId(m.id);
                    const debt = myDebts.find((d: { toUserId: number; amount: number }) => d.toUserId === m.id);
                    if (debt) setAmount(String(debt.amount));
                  }}
                >
                  <Text
                    style={[
                      s.memberChipText,
                      toUserId === m.id && s.memberChipTextActive,
                    ]}
                  >
                    {m.name}
                  </Text>
                </Pressable>
              ))}
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Note (optional)</Text>
          <TextInput
            style={s.input}
            value={note}
            onChangeText={setNote}
            placeholder="Venmo, cash, etc."
            placeholderTextColor={colors.mutedForeground}
          />
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
      backgroundColor: colors.accent,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    saveBtnText: {
      color: colors.accentForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    content: { padding: 20, gap: 20 },
    debtCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 8,
    },
    debtLabel: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    debtRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    debtName: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    debtAmount: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
    settledCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settledText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.positive,
      textAlign: "center",
    },
    amountCard: {
      backgroundColor: colors.accent,
      borderRadius: 20,
      padding: 24,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    currencySymbol: {
      fontSize: 32,
      fontFamily: "Inter_700Bold",
      color: "rgba(255,255,255,0.8)",
    },
    amountInput: {
      fontSize: 48,
      fontFamily: "Inter_700Bold",
      color: "#fff",
      letterSpacing: -1,
      minWidth: 120,
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
    memberGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    memberChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    memberChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    memberChipText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    memberChipTextActive: { color: colors.accentForeground },
    errorText: {
      color: colors.destructive,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      textAlign: "center",
    },
  });
