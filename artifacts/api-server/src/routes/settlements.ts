import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import { db, settlementsTable, groupMembersTable, usersTable, activityLogTable } from "@workspace/db";
import { CreateSettlementBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { sendSettlementEmail } from "../lib/email";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

router.get("/groups/:groupId/settlements", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const [member] = await db.select().from(groupMembersTable).where(
    and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.user!.userId))
  );
  if (!member) {
    res.status(403).json({ error: "Not a member of this group" });
    return;
  }
  const settlements = await db.select().from(settlementsTable)
    .where(eq(settlementsTable.groupId, groupId))
    .orderBy(settlementsTable.createdAt);

  const userIds = [...new Set(settlements.flatMap(s => [s.paidBy, s.paidTo]))];
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  res.json(settlements.map(s => ({
    id: s.id,
    groupId: s.groupId,
    paidBy: s.paidBy,
    paidByName: userMap[s.paidBy]?.name ?? "Unknown",
    paidByAvatarUrl: userMap[s.paidBy]?.avatarUrl ?? null,
    paidTo: s.paidTo,
    paidToName: userMap[s.paidTo]?.name ?? "Unknown",
    paidToAvatarUrl: userMap[s.paidTo]?.avatarUrl ?? null,
    amount: Number(s.amount),
    note: s.note,
    createdAt: s.createdAt.toISOString(),
  })));
});

router.post("/groups/:groupId/settlements", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const [member] = await db.select().from(groupMembersTable).where(
    and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.user!.userId))
  );
  if (!member) {
    res.status(403).json({ error: "Not a member of this group" });
    return;
  }
  const parsed = CreateSettlementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { paidTo, amount, note } = parsed.data;
  const [settlement] = await db.insert(settlementsTable).values({
    groupId,
    paidBy: req.user!.userId,
    paidTo,
    amount: String(amount),
    note: note ?? null,
  }).returning();

  const [payer] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  const [payee] = await db.select().from(usersTable).where(eq(usersTable.id, paidTo));

  await db.insert(activityLogTable).values({
    groupId,
    userId: req.user!.userId,
    actionType: "settlement",
    description: `${payer.name} paid ${payee?.name ?? "someone"} ${amount}`,
  });

  if (payee) {
    await sendSettlementEmail(payee.email, payee.name, payer.name, payee.name, amount, "USD", "your group");
  }

  const userMap: Record<number, typeof payer> = { [payer.id]: payer };
  if (payee) userMap[payee.id] = payee;

  res.status(201).json({
    id: settlement.id,
    groupId: settlement.groupId,
    paidBy: settlement.paidBy,
    paidByName: payer.name,
    paidByAvatarUrl: payer.avatarUrl,
    paidTo: settlement.paidTo,
    paidToName: payee?.name ?? "Unknown",
    paidToAvatarUrl: payee?.avatarUrl ?? null,
    amount: Number(settlement.amount),
    note: settlement.note,
    createdAt: settlement.createdAt.toISOString(),
  });
});

export default router;
