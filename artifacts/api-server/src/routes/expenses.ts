import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, expensesTable, expenseSplitsTable, groupMembersTable, usersTable, activityLogTable } from "@workspace/db";
import { CreateExpenseBody, UpdateExpenseBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { sendExpenseNotificationEmail } from "../lib/email";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

async function notifyGroupMembers(
  groupId: number,
  excludeUserId: number,
  action: "added" | "updated" | "deleted",
  expenseTitle: string,
  amount: number,
  currency: string,
  groupName: string,
  actorName: string
) {
  const memberships = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const otherIds = memberships.map(m => m.userId).filter(id => id !== excludeUserId);
  if (!otherIds.length) return;
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, otherIds));
  await Promise.all(users.map(u => sendExpenseNotificationEmail(u.email, u.name, action, expenseTitle, amount, currency, groupName, actorName)));
}

async function buildExpenseResponse(expense: typeof expensesTable.$inferSelect) {
  const splits = await db.select().from(expenseSplitsTable).where(eq(expenseSplitsTable.expenseId, expense.id));
  const userIds = [...new Set([expense.paidBy, ...splits.map(s => s.userId)])];
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, userIds));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const paidByUser = userMap[expense.paidBy];

  return {
    id: expense.id,
    groupId: expense.groupId,
    title: expense.title,
    description: expense.description,
    amount: Number(expense.amount),
    currency: expense.currency,
    category: expense.category,
    date: expense.date,
    paidBy: expense.paidBy,
    paidByName: paidByUser?.name ?? "Unknown",
    paidByAvatarUrl: paidByUser?.avatarUrl ?? null,
    splitType: expense.splitType,
    splits: splits.map(s => ({
      userId: s.userId,
      userName: userMap[s.userId]?.name ?? "Unknown",
      avatarUrl: userMap[s.userId]?.avatarUrl ?? null,
      amountOwed: Number(s.amountOwed),
      percentage: s.percentage ? Number(s.percentage) : null,
    })),
    receiptUrl: expense.receiptUrl,
    createdBy: expense.createdBy,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

router.get("/groups/:groupId/expenses", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const [member] = await db.select().from(groupMembersTable).where(
    and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.user!.userId))
  );
  if (!member) {
    res.status(403).json({ error: "Not a member of this group" });
    return;
  }
  const expenses = await db.select().from(expensesTable)
    .where(eq(expensesTable.groupId, groupId))
    .orderBy(expensesTable.createdAt);

  const result = await Promise.all(expenses.map(buildExpenseResponse));
  res.json(result);
});

router.post("/groups/:groupId/expenses", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const [member] = await db.select().from(groupMembersTable).where(
    and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.user!.userId))
  );
  if (!member) {
    res.status(403).json({ error: "Not a member of this group" });
    return;
  }
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;

  type SplitItem = { userId: number; amount: number; percentage?: number | null };
  let splits: SplitItem[] = data.splits.map(s => ({ userId: s.userId, amount: s.amount, percentage: s.percentage ?? null }));
  if (data.splitType === "equal") {
    const equalAmount = Number(data.amount) / splits.length;
    splits = splits.map((s: SplitItem) => ({ ...s, amount: Math.round(equalAmount * 100) / 100 }));
  }

  const [expense] = await db.insert(expensesTable).values({
    groupId,
    title: data.title,
    description: data.description ?? null,
    amount: String(data.amount),
    currency: data.currency ?? "USD",
    category: data.category,
    date: data.date ? String(data.date) : null,
    paidBy: data.paidBy,
    splitType: data.splitType,
    receiptUrl: data.receiptUrl ?? null,
    createdBy: req.user!.userId,
  }).returning();

  await Promise.all(splits.map((s: SplitItem) =>
    db.insert(expenseSplitsTable).values({
      expenseId: expense.id,
      userId: s.userId,
      amountOwed: String(s.amount),
      percentage: s.percentage != null ? String(s.percentage) : null,
    })
  ));

  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  await db.insert(activityLogTable).values({
    groupId,
    userId: req.user!.userId,
    actionType: "expense_added",
    description: `${actor.name} added expense "${data.title}" (${data.currency ?? "USD"} ${data.amount})`,
  });

  await notifyGroupMembers(groupId, req.user!.userId, "added", data.title, Number(data.amount), data.currency ?? "USD", "your group", actor.name);

  const result = await buildExpenseResponse(expense);
  res.status(201).json(result);
});

router.get("/groups/:groupId/expenses/:expenseId", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const expenseId = parseId(req.params.expenseId);
  const [expense] = await db.select().from(expensesTable).where(
    and(eq(expensesTable.id, expenseId), eq(expensesTable.groupId, groupId))
  );
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(await buildExpenseResponse(expense));
});

router.put("/groups/:groupId/expenses/:expenseId", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const expenseId = parseId(req.params.expenseId);
  const [expense] = await db.select().from(expensesTable).where(
    and(eq(expensesTable.id, expenseId), eq(expensesTable.groupId, groupId))
  );
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }

  const [member] = await db.select().from(groupMembersTable).where(
    and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.user!.userId))
  );
  if (!member || (expense.createdBy !== req.user!.userId && member.role !== "admin")) {
    res.status(403).json({ error: "Unauthorized to edit this expense" });
    return;
  }

  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.amount !== undefined) updates.amount = String(parsed.data.amount);
  if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.date !== undefined) updates.date = parsed.data.date;
  if (parsed.data.paidBy !== undefined) updates.paidBy = parsed.data.paidBy;
  if (parsed.data.splitType !== undefined) updates.splitType = parsed.data.splitType;

  const [updated] = await db.update(expensesTable).set(updates).where(eq(expensesTable.id, expenseId)).returning();

  if (parsed.data.splits?.length) {
    await db.delete(expenseSplitsTable).where(eq(expenseSplitsTable.expenseId, expenseId));
    await Promise.all(parsed.data.splits.map((s: { userId: number; amount: number; percentage?: number | null }) =>
      db.insert(expenseSplitsTable).values({
        expenseId,
        userId: s.userId,
        amountOwed: String(s.amount),
        percentage: s.percentage != null ? String(s.percentage) : null,
      })
    ));
  }

  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  await db.insert(activityLogTable).values({
    groupId,
    userId: req.user!.userId,
    actionType: "expense_updated",
    description: `${actor.name} updated expense "${updated.title}"`,
  });

  await notifyGroupMembers(groupId, req.user!.userId, "updated", updated.title, Number(updated.amount), updated.currency, "your group", actor.name);

  res.json(await buildExpenseResponse(updated));
});

router.delete("/groups/:groupId/expenses/:expenseId", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const expenseId = parseId(req.params.expenseId);
  const [expense] = await db.select().from(expensesTable).where(
    and(eq(expensesTable.id, expenseId), eq(expensesTable.groupId, groupId))
  );
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  const [member] = await db.select().from(groupMembersTable).where(
    and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.user!.userId))
  );
  if (!member || (expense.createdBy !== req.user!.userId && member.role !== "admin")) {
    res.status(403).json({ error: "Unauthorized to delete this expense" });
    return;
  }

  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  await notifyGroupMembers(groupId, req.user!.userId, "deleted", expense.title, Number(expense.amount), expense.currency, "your group", actor.name);
  await db.insert(activityLogTable).values({
    groupId,
    userId: req.user!.userId,
    actionType: "expense_deleted",
    description: `${actor.name} deleted expense "${expense.title}"`,
  });

  await db.delete(expensesTable).where(eq(expensesTable.id, expenseId));
  res.sendStatus(204);
});

export default router;
