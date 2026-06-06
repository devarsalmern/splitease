import {
  useGetGroup,
  useGetGroupBalances,
  useListExpenses,
  useDeleteExpense,
  useLeaveGroup,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function formatCurrency(amount: number | string, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency),
    minimumFractionDigits: 2,
  }).format(Math.abs(Number(amount)));
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

type Tab = "expenses" | "balances";

export default function GroupDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("expenses");

  const { data: group, isLoading: groupLoading, refetch: refetchGroup } = useGetGroup(groupId);
  const { data: balances, isLoading: balancesLoading, refetch: refetchBalances } = useGetGroupBalances(groupId);
  const { data: expenses, isLoading: expensesLoading, refetch: refetchExpenses, isRefetching } = useListExpenses(groupId);

  const deleteExpense = useDeleteExpense({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
    },
  });

  const leaveGroup = useLeaveGroup({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries();
        router.replace("/(tabs)");
      },
    },
  });

  const refetchAll = () => {
    refetchGroup();
    refetchBalances();
    refetchExpenses();
  };

  const s = styles(colors);

  const handleDeleteExpense = (expenseId: number, title: string) => {
    Alert.alert(
      "Delete Expense",
      `Delete "${title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteExpense.mutate({ groupId, expenseId }),
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert("Leave Group", `Leave "${group?.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => leaveGroup.mutate({ groupId }),
      },
    ]);
  };

  if (groupLoading) {
    return (
      <View style={[s.container, { paddingTop: insets.top, justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{group?.name ?? "Group"}</Text>
          {!!group?.description && (
            <Text style={s.headerSub} numberOfLines={1}>{group.description}</Text>
          )}
        </View>
        <Pressable style={s.moreBtn} onPress={handleLeaveGroup}>
          <Feather name="log-out" size={20} color={colors.destructive} />
        </Pressable>
      </View>

      <View style={s.tabRow}>
        {(["expenses", "balances"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "expenses" ? (
        <FlatList
          data={expenses ?? []}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetchAll}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 120,
            gap: 10,
            paddingTop: 8,
          }}
          ListEmptyComponent={
            expensesLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={s.emptyState}>
                <Feather name="dollar-sign" size={48} color={colors.mutedForeground} />
                <Text style={s.emptyTitle}>No expenses yet</Text>
                <Text style={s.emptyText}>Add the first expense to this group</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [s.expenseCard, pressed && { opacity: 0.75 }]}
              onLongPress={() => handleDeleteExpense(item.id, item.title)}
            >
              <View style={s.expenseIcon}>
                <Feather name="credit-card" size={18} color={colors.primary} />
              </View>
              <View style={s.expenseInfo}>
                <Text style={s.expenseTitle}>{item.title}</Text>
                <Text style={s.expenseMeta}>
                  Paid by {item.paidByName} • {formatDate(item.createdAt)}
                </Text>
              </View>
              <Text style={s.expenseAmount}>
                {item.currency} {formatCurrency(item.amount, item.currency)}
              </Text>
            </Pressable>
          )}
          scrollEnabled={!!(expenses?.length)}
        />
      ) : (
        <FlatList
          data={balances?.simplifiedDebts ?? []}
          keyExtractor={(item) => `${item.fromUserId}-${item.toUserId}`}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refetchBalances}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 120,
            gap: 10,
            paddingTop: 8,
          }}
          ListEmptyComponent={
            balancesLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <View style={s.emptyState}>
                <Feather name="check-circle" size={48} color={colors.positive} />
                <Text style={s.emptyTitle}>All settled up!</Text>
                <Text style={s.emptyText}>No outstanding balances in this group</Text>
              </View>
            )
          }
          renderItem={({ item }: { item: { fromUserId: number; fromUserName: string; toUserId: number; toUserName: string; amount: number } }) => (
            <View style={s.balanceCard}>
              <View style={s.balanceInfo}>
                <Text style={s.balanceFrom}>{item.fromUserName}</Text>
                <View style={s.balanceArrow}>
                  <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
                </View>
                <Text style={s.balanceTo}>{item.toUserName}</Text>
              </View>
              <Text style={[s.balanceAmount, { color: colors.negative }]}>
                {formatCurrency(item.amount)}
              </Text>
            </View>
          )}
          scrollEnabled={!!(balances?.simplifiedDebts?.length)}
        />
      )}

      <View
        style={[
          s.fab,
          { bottom: insets.bottom + 100 },
        ]}
      >
        <Pressable
          style={({ pressed }) => [s.fabBtn, s.fabSettle, pressed && { opacity: 0.8 }]}
          onPress={() => router.push({ pathname: "/settle-up", params: { groupId } })}
        >
          <Feather name="check" size={18} color={colors.accentForeground} />
          <Text style={s.fabBtnText}>Settle</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.fabBtn, pressed && { opacity: 0.8 }]}
          onPress={() => router.push({ pathname: "/add-expense", params: { groupId } })}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={s.fabBtnText}>Add Expense</Text>
        </Pressable>
      </View>
    </View>
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
      gap: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    headerCenter: { flex: 1 },
    headerTitle: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    headerSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    moreBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    tabRow: {
      flexDirection: "row",
      marginHorizontal: 20,
      marginBottom: 8,
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 4,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: "center",
    },
    tabBtnActive: { backgroundColor: colors.card },
    tabText: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    tabTextActive: {
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
    },
    expenseCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    expenseIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    expenseInfo: { flex: 1 },
    expenseTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    expenseMeta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    expenseAmount: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    balanceCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    balanceInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    balanceFrom: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    balanceArrow: { paddingHorizontal: 2 },
    balanceTo: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    balanceAmount: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
    emptyState: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginTop: 8,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
    },
    fab: {
      position: "absolute",
      right: 20,
      flexDirection: "row",
      gap: 10,
    },
    fabBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    fabSettle: { backgroundColor: colors.accent },
    fabBtnText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
  });
