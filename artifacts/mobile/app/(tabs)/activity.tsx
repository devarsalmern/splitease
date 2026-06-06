import { useListGroups, useGetGroupActivity } from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function ActivityIcon({ type }: { type: string }) {
  const colors = useColors();
  const icons: Record<string, { name: string; bg: string; color: string }> = {
    expense_added: { name: "plus-circle", bg: colors.secondary, color: colors.primary },
    expense_updated: { name: "edit-2", bg: "#fef3c7", color: colors.warning },
    expense_deleted: { name: "trash-2", bg: "#fee2e2", color: colors.negative },
    settlement: { name: "check-circle", bg: "#d1fae5", color: colors.positive },
    member_joined: { name: "user-plus", bg: colors.secondary, color: colors.primary },
    member_left: { name: "user-minus", bg: "#fee2e2", color: colors.negative },
    group_created: { name: "users", bg: colors.secondary, color: colors.primary },
  };
  const icon = icons[type] ?? icons.expense_added;
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: icon.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name={icon.name as any} size={18} color={icon.color} />
    </View>
  );
}

function ActivityFeedForGroup({ groupId }: { groupId: number }) {
  const colors = useColors();
  const { data, isLoading, refetch, isRefetching } = useGetGroupActivity(groupId);
  const insets = useSafeAreaInsets();
  const s = styles(colors);

  if (isLoading) {
    return (
      <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
    );
  }

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 100,
        gap: 2,
      }}
      ListEmptyComponent={
        <View style={s.emptyState}>
          <Feather name="activity" size={48} color={colors.mutedForeground} />
          <Text style={s.emptyTitle}>No activity yet</Text>
          <Text style={s.emptyText}>Activity from your groups will appear here</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={s.activityItem}>
          <ActivityIcon type={item.actionType} />
          <View style={s.activityContent}>
            <Text style={s.activityDesc}>{item.description}</Text>
            <Text style={s.activityTime}>{timeAgo(item.createdAt)}</Text>
          </View>
        </View>
      )}
      scrollEnabled={!!(data?.length)}
    />
  );
}

export default function ActivityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: groups, isLoading: groupsLoading } = useListGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const s = styles(colors);

  const activeGroupId =
    selectedGroupId ?? (groups && groups.length > 0 ? groups[0].id : null);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>Activity</Text>
      </View>

      {groupsLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : !groups?.length ? (
        <View style={s.emptyState}>
          <Feather name="activity" size={52} color={colors.mutedForeground} />
          <Text style={s.emptyTitle}>No activity yet</Text>
          <Text style={s.emptyText}>Join a group to see activity here</Text>
        </View>
      ) : (
        <>
          {groups.length > 1 && (
            <FlatList
              horizontal
              data={groups}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.groupPills}
              renderItem={({ item }) => {
                const isActive = item.id === activeGroupId;
                return (
                  <View
                    style={[s.pill, isActive && s.pillActive]}
                    onStartShouldSetResponder={() => true}
                    onResponderRelease={() => setSelectedGroupId(item.id)}
                  >
                    <Text style={[s.pillText, isActive && s.pillTextActive]}>
                      {item.name}
                    </Text>
                  </View>
                );
              }}
            />
          )}
          {activeGroupId !== null && (
            <ActivityFeedForGroup groupId={activeGroupId} />
          )}
        </>
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    title: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    groupPills: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      gap: 8,
    },
    pill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    pillTextActive: { color: colors.primaryForeground },
    activityItem: {
      flexDirection: "row",
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: "flex-start",
    },
    activityContent: { flex: 1, gap: 3 },
    activityDesc: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 20,
    },
    activityTime: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingHorizontal: 40,
    },
    emptyTitle: {
      fontSize: 20,
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
  });
