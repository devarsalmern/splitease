import { pgTable, text, serial, timestamp, integer, numeric, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { groupsTable } from "./groups";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  category: text("category", { enum: ["food", "transport", "accommodation", "entertainment", "utilities", "other"] }).notNull().default("other"),
  date: date("date", { mode: "string" }),
  paidBy: integer("paid_by").notNull().references(() => usersTable.id),
  splitType: text("split_type", { enum: ["equal", "exact", "percentage"] }).notNull().default("equal"),
  receiptUrl: text("receipt_url"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const expenseSplitsTable = pgTable("expense_splits", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull().references(() => expensesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amountOwed: numeric("amount_owed", { precision: 10, scale: 2 }).notNull(),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
export type ExpenseSplit = typeof expenseSplitsTable.$inferSelect;
