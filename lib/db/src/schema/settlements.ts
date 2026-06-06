import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { groupsTable } from "./groups";

export const settlementsTable = pgTable("settlements", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  paidBy: integer("paid_by").notNull().references(() => usersTable.id),
  paidTo: integer("paid_to").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSettlementSchema = createInsertSchema(settlementsTable).omit({ id: true, createdAt: true });
export type InsertSettlement = z.infer<typeof insertSettlementSchema>;
export type Settlement = typeof settlementsTable.$inferSelect;
