import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { groupsTable } from "./groups";

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  actionType: text("action_type").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ActivityLog = typeof activityLogTable.$inferSelect;
