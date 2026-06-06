import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const groupMembersTable = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupInvitationsTable = pgTable("group_invitations", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  invitedBy: integer("invited_by").notNull().references(() => usersTable.id),
  token: text("token").notNull().unique(),
  status: text("status", { enum: ["pending", "accepted", "declined"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGroupSchema = createInsertSchema(groupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groupsTable.$inferSelect;
export type GroupMember = typeof groupMembersTable.$inferSelect;
