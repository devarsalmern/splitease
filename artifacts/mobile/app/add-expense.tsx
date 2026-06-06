import { useCreateExpense, useGetGroup } from "@workspace/api-client-react";
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

const SPLIT_TYPES = [
  { key: "equal", label: "Split Equally" },
  { key: "exact", label: "Exact Amounts" },
  { key: "percentage", label: "By Percentage" },
];

const CATEGORIES = [
  { key: "food", label: "Food" },
  { key: "transport", label: "Transport" },
  { key: "accommodation", label: "Stay" },
  { key: "entertainment", label: "Fun" },
  { key: "utilities", label: "Utilities" },
  { key: "other", label: "Other" },
] as const;

type Category = "food" | "transport" | "accommodation" | "entertainment" | "utilities" | "other";

export default function AddExpenseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const gid = Number(groupId);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: group } = useGetGroup(gid);
  const members = group?.members ?? [];

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState<"equal" | "exact" | "percentage">("equal");
  const [category, setCategory] = useState<Category>("other");
  const [paidBy, setPaidBy] = useState(user?.userId ?? 0);
  const [error, setError] = useState("");
  const [exactAmounts, setExactAmounts] = useState<Record<number, string>>({});
  const [percentages, setPercentages] = useState<Record<number, string>>({});

  const createExpense = useCreateExpense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.back();
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Failed to create expense";
        setError(msg);
      },
    },
  });

  const buildSplits = () => {
    const total = parseFloat(amount);
    if (!members.length) return [];
    if (splitType === "equal") {
      const share = Math.round((total / members.length) * 100) / 100;
      return members.map((m) => ({ userId: m.id, amount: share, percentage: null }));
    }
    if (splitType === "exact") {
      return members.map((m) => ({
        userId: m.id,
        amount: parseFloat(exactAmounts[m.id] ?? "0") || 0,
        percentage: null,
      }));
    }
    if (splitType === "percentage") {
      return members.map((m) => {
        const pct = parseFloat(percentages[m.id] ?? "0") || 0;
        return {
          userId: m.id,
          amount: Math.round((total * pct) / 100 * 100) / 100,
          percentage: pct,
        };
      });
    }
    return [];
  };

  const handleSubmit = () => {
    setError("");
    if (!title.trim()) { setError("Title is required"); return; }
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setError("Enter a valid amount"); return; }
    if (!paidBy) { setError("Select who paid"); return; }

    const splits = buildSplits();
    if (!splits.length) { setError("No members to split with"); return; }

    createExpense.mutate({
      groupId: gid,
      data: {
        title: title.trim(),
        amount: amt,
        splitType,
        category,
        paidBy,
        splits,
        currency: "USD",
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
        <Text style={s.title}>Add Expense</Text>
        <Pressable
          style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.8 }]}
          onPress={handleSubmit}
          disabled={createExpense.isPending}
        >
          {createExpense.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <Text style={s.saveBtnText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
          <Text style={s.label}>Description</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What's this for?"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <View style={s.field}>
          <Text style={s.label}>Category</Text>
          <View style={s.memberGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                style={[s.memberChip, category === cat.key && s.memberChipActive]}
                onPress={() => setCategory(cat.key)}
              >
                <Text style={[s.memberChipText, category === cat.key && s.memberChipTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Paid by</Text>
          <View style={s.memberGrid}>
            {members.map((m) => (
              <Pressable
                key={m.id}
                style={[s.memberChip, paidBy === m.id && s.memberChipActive]}
                onPress={() => setPaidBy(m.id)}
              >
                <Text style={[s.memberChipText, paidBy === m.id && s.memberChipTextActive]}>
                  {m.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.label}>Split type</Text>
          <View style={s.splitTypeRow}>
            {SPLIT_TYPES.map((st) => (
              <Pressable
                key={st.key}
                style={[s.splitChip, splitType === st.key && s.splitChipActive]}
                onPress={() => setSplitType(st.key as "equal" | "exact" | "percentage")}
              >
                <Text style={[s.splitChipText, splitType === st.key && s.splitChipTextActive]}>
                  {st.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {splitType === "exact" && (
          <View style={s.field}>
            <Text style={s.label}>Amounts per person</Text>
            {members.map((m) => (
              <View key={m.id} style={s.memberRow}>
                <Text style={s.memberRowName}>{m.name}</Text>
                <TextInput
                  style={s.smallInput}
                  value={exactAmounts[m.id] ?? ""}
                  onChangeText={(v) => setExactAmounts((prev) => ({ ...prev, [m.id]: v }))}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </View>
        )}

        {splitType === "percentage" && (
          <View style={s.field}>
            <Text style={s.label}>Percentage per person</Text>
            {members.map((m) => (
              <View key={m.id} style={s.memberRow}>
                <Text style={s.memberRowName}>{m.name}</Text>
                <TextInput
                  style={s.smallInput}
                  value={percentages[m.id] ?? ""}
                  onChangeText={(v) => setPercentages((prev) => ({ ...prev, [m.id]: v }))}
                  placeholder="0%"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </View>
        )}

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
    amountCard: {
      backgroundColor: colors.primary,
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
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    memberChipText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    memberChipTextActive: { color: colors.primaryForeground },
    splitTypeRow: { gap: 8 },
    splitChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    splitChipActive: {
      backgroundColor: colors.secondary,
      borderColor: colors.primary,
    },
    splitChipText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    splitChipTextActive: {
      color: colors.primary,
      fontFamily: "Inter_500Medium",
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    memberRowName: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      flex: 1,
    },
    smallInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      backgroundColor: colors.card,
      width: 90,
      textAlign: "right",
    },
    errorText: {
      color: colors.destructive,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      textAlign: "center",
    },
  });
