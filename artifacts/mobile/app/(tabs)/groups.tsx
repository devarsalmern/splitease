import { useListGroups } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

export default function GroupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: groups, isLoading, refetch, isRefetching } = useListGroups();

  const s = styles(colors);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>Groups</Text>
        <Pressable
          style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.8 }]}
          onPress={() => router.push("/create-group")}
        >
          <Feather name="plus" size={22} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: 60 }}
        />
      ) : !groups?.length ? (
        <View style={s.emptyState}>
          <Feather name="users" size={52} color={colors.mutedForeground} />
          <Text style={s.emptyTitle}>No groups yet</Text>
          <Text style={s.emptyText}>
            Create a group to start splitting expenses with friends
          </Text>
          <Pressable
            style={s.createBtn}
            onPress={() => router.push("/create-group")}
          >
            <Text style={s.createBtnText}>Create Group</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={groups}
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
            gap: 10,
          }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [s.groupCard, pressed && { opacity: 0.75 }]}
              onPress={() => router.push(`/group/${item.id}`)}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={s.groupInfo}>
                <Text style={s.groupName}>{item.name}</Text>
                {!!item.description && (
                  <Text style={s.groupDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
                <Text style={s.groupMeta}>
                  {item.memberCount} member{item.memberCount !== 1 ? "s" : ""}
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          )}
          scrollEnabled={!!groups?.length}
        />
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    title: {
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    addBtn: {
      backgroundColor: colors.primary,
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
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
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.secondary,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    groupInfo: { flex: 1, gap: 2 },
    groupName: {
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    groupDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    groupMeta: {
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
      lineHeight: 20,
    },
    createBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 28,
      paddingVertical: 14,
      marginTop: 8,
    },
    createBtnText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
    },
  });
