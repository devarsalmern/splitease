import { useGetDashboard, useListGroups } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();

  const { data: dashboard, isLoading, refetch, isRefetching } = useGetDashboard();
  const { data: groups } = useListGroups();

  const s = styles(colors);

  const totalBalance = dashboard?.totalBalance ?? 0;
  const youOwe = dashboard?.totalOwe ?? 0;
  const youAreOwed = dashboard?.totalOwed ?? 0;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={[
        s.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
      ]}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={s.headerRow}>
        <View>
          <Text style={s.greeting}>Hello, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={s.subGreeting}>Here's your balance summary</Text>
        </View>
        <Pressable style={s.addBtn} onPress={() => router.push("/create-group")}>
          <Feather name="plus" size={22} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Total Balance</Text>
            <Text
              style={[
                s.balanceAmount,
                { color: totalBalance >= 0 ? colors.positive : colors.negative },
              ]}
            >
              {totalBalance >= 0 ? "+" : "-"}
              {formatCurrency(totalBalance)}
            </Text>
            <View style={s.balanceRow}>
              <View style={s.balanceItem}>
                <Text style={s.balanceItemLabel}>You owe</Text>
                <Text style={[s.balanceItemAmount, { color: colors.negative }]}>
                  {formatCurrency(youOwe)}
                </Text>
              </View>
              <View style={s.divider} />
              <View style={s.balanceItem}>
                <Text style={s.balanceItemLabel}>Owed to you</Text>
                <Text style={[s.balanceItemAmount, { color: colors.positive }]}>
                  {formatCurrency(youAreOwed)}
                </Text>
              </View>
            </View>
          </View>

          <Text style={s.sectionTitle}>My Groups</Text>
          {!groups?.length ? (
            <View style={s.emptyState}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={s.emptyText}>No groups yet</Text>
              <Text style={s.emptySubText}>Create a group to start splitting expenses</Text>
              <Pressable style={s.emptyBtn} onPress={() => router.push("/create-group")}>
                <Text style={s.emptyBtnText}>Create Group</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.groupsList}>
              {groups.map((group) => (
                <Pressable
                  key={group.id}
                  style={({ pressed }) => [s.groupCard, pressed && s.pressed]}
                  onPress={() => router.push(`/group/${group.id}`)}
                >
                  <View style={s.groupAvatar}>
                    <Text style={s.groupAvatarText}>
                      {group.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={s.groupInfo}>
                    <Text style={s.groupName}>{group.name}</Text>
                    <Text style={s.groupMeta}>
                      {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 20, gap: 20 },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    greeting: {
      fontSize: 24,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    subGreeting: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    addBtn: {
      backgroundColor: colors.primary,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    balanceCard: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      padding: 24,
      gap: 8,
    },
    balanceLabel: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: "rgba(255,255,255,0.7)",
    },
    balanceAmount: {
      fontSize: 40,
      fontFamily: "Inter_700Bold",
      color: "#fff",
      letterSpacing: -1,
    },
    balanceRow: {
      flexDirection: "row",
      marginTop: 12,
      gap: 16,
    },
    balanceItem: { flex: 1, gap: 4 },
    balanceItemLabel: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: "rgba(255,255,255,0.6)",
    },
    balanceItemAmount: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: "#fff",
    },
    divider: {
      width: 1,
      backgroundColor: "rgba(255,255,255,0.2)",
    },
    sectionTitle: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    groupsList: { gap: 10 },
    groupCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressed: { opacity: 0.75 },
    groupAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    groupAvatarText: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    groupInfo: { flex: 1 },
    groupName: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    groupMeta: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    emptyState: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginTop: 8,
    },
    emptySubText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
    },
    emptyBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 12,
      marginTop: 8,
    },
    emptyBtnText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
  });
