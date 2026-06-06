import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, groupsTable, groupMembersTable, usersTable, expensesTable, expenseSplitsTable, settlementsTable, activityLogTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const memberships = await db.select().from(groupMembersTable).where(eq(groupMembersTable.userId, userId));
  const groupIds = memberships.map(m => m.groupId);

  if (!groupIds.length) {
    res.json({ totalBalance: 0, totalOwed: 0, totalOwe: 0, groupBalances: [], recentActivity: [] });
    return;
  }

  const groups = await db.select().from(groupsTable).where(inArray(groupsTable.id, groupIds));
  const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));

  const groupBalances: { groupId: number; groupName: string; balance: number }[] = [];
  let totalOwed = 0;
  let totalOwe = 0;

  for (const gid of groupIds) {
    const allMembers = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, gid));
    const allUserIds = allMembers.map(m => m.userId);
    const netMap: Record<number, number> = {};
    for (const uid of allUserIds) netMap[uid] = 0;

    const expenses = await db.select().from(expensesTable).where(eq(expensesTable.groupId, gid));
    for (const exp of expenses) {
      const splits = await db.select().from(expenseSplitsTable).where(eq(expenseSplitsTable.expenseId, exp.id));
      netMap[exp.paidBy] = (netMap[exp.paidBy] ?? 0) + Number(exp.amount);
      for (const split of splits) {
        netMap[split.userId] = (netMap[split.userId] ?? 0) - Number(split.amountOwed);
      }
    }

    const settlements = await db.select().from(settlementsTable).where(eq(settlementsTable.groupId, gid));
    for (const s of settlements) {
      netMap[s.paidBy] = (netMap[s.paidBy] ?? 0) - Number(s.amount);
      netMap[s.paidTo] = (netMap[s.paidTo] ?? 0) + Number(s.amount);
    }

    const myBalance = Math.round((netMap[userId] ?? 0) * 100) / 100;
    if (myBalance > 0) totalOwed += myBalance;
    else totalOwe += Math.abs(myBalance);

    groupBalances.push({ groupId: gid, groupName: groupMap[gid]?.name ?? "Unknown", balance: myBalance });
  }

  const recentActivities = await db.select().from(activityLogTable)
    .where(inArray(activityLogTable.groupId, groupIds))
    .orderBy(activityLogTable.createdAt)
    .limit(10);

  const actorIds = [...new Set(recentActivities.map(a => a.userId))];
  const actors = actorIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, actorIds)) : [];
  const actorMap = Object.fromEntries(actors.map(u => [u.id, u]));

  res.json({
    totalBalance: Math.round((totalOwed - totalOwe) * 100) / 100,
    totalOwed: Math.round(totalOwed * 100) / 100,
    totalOwe: Math.round(totalOwe * 100) / 100,
    groupBalances,
    recentActivity: recentActivities.map(a => ({
      id: a.id,
      groupId: a.groupId,
      userId: a.userId,
      userName: actorMap[a.userId]?.name ?? "Unknown",
      userAvatarUrl: actorMap[a.userId]?.avatarUrl ?? null,
      actionType: a.actionType,
      description: a.description,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

export default router;
