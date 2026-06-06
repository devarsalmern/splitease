import { Router, type IRouter } from "express";
import crypto from "crypto";
import { eq, and, inArray } from "drizzle-orm";
import { db, groupsTable, groupMembersTable, groupInvitationsTable, usersTable, activityLogTable, expensesTable, expenseSplitsTable, settlementsTable } from "@workspace/db";
import { CreateGroupBody, UpdateGroupBody, InviteToGroupBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { sendGroupInviteEmail } from "../lib/email";
import { simplifyDebts, type Balance } from "../lib/balances";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

async function logActivity(groupId: number, userId: number, actionType: string, description: string, metadata?: object) {
  await db.insert(activityLogTable).values({ groupId, userId, actionType, description, metadata: metadata ?? null });
}

async function assertMember(groupId: number, userId: number): Promise<{ role: string } | null> {
  const [member] = await db.select().from(groupMembersTable).where(
    and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId))
  );
  return member ?? null;
}

router.get("/groups", requireAuth, async (req, res): Promise<void> => {
  const memberships = await db.select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.userId, req.user!.userId));

  if (!memberships.length) {
    res.json([]);
    return;
  }
  const groupIds = memberships.map(m => m.groupId);
  const groups = await db.select().from(groupsTable).where(inArray(groupsTable.id, groupIds));

  const memberCounts = await db.select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable)
    .where(inArray(groupMembersTable.groupId, groupIds));

  const countMap: Record<number, number> = {};
  for (const m of memberCounts) countMap[m.groupId] = (countMap[m.groupId] ?? 0) + 1;

  res.json(groups.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description,
    imageUrl: g.imageUrl,
    memberCount: countMap[g.id] ?? 0,
    myBalance: 0,
    createdAt: g.createdAt.toISOString(),
  })));
});

router.post("/groups", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [group] = await db.insert(groupsTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    imageUrl: parsed.data.imageUrl ?? null,
    createdBy: req.user!.userId,
  }).returning();

  await db.insert(groupMembersTable).values({ groupId: group.id, userId: req.user!.userId, role: "admin" });
  await logActivity(group.id, req.user!.userId, "group_created", `Created the group "${group.name}"`);

  const [creator] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  res.status(201).json({
    id: group.id,
    name: group.name,
    description: group.description,
    imageUrl: group.imageUrl,
    createdBy: group.createdBy,
    members: [{
      id: creator.id,
      name: creator.name,
      email: creator.email,
      avatarUrl: creator.avatarUrl,
      role: "admin",
      joinedAt: new Date().toISOString(),
    }],
    createdAt: group.createdAt.toISOString(),
  });
});

router.get("/groups/:groupId", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const member = await assertMember(groupId, req.user!.userId);
  if (!member) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const memberships = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const userIds = memberships.map(m => m.userId);
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  res.json({
    id: group.id,
    name: group.name,
    description: group.description,
    imageUrl: group.imageUrl,
    createdBy: group.createdBy,
    members: memberships.map(m => {
      const u = userMap[m.userId];
      return { id: u?.id, name: u?.name, email: u?.email, avatarUrl: u?.avatarUrl, role: m.role, joinedAt: m.joinedAt.toISOString() };
    }),
    createdAt: group.createdAt.toISOString(),
  });
});

router.put("/groups/:groupId", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const member = await assertMember(groupId, req.user!.userId);
  if (!member || member.role !== "admin") {
    res.status(403).json({ error: "Only admins can update the group" });
    return;
  }
  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.imageUrl !== undefined) updates.imageUrl = parsed.data.imageUrl;

  const [group] = await db.update(groupsTable).set(updates).where(eq(groupsTable.id, groupId)).returning();
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const memberships = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, memberships.map(m => m.userId)));
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  res.json({
    id: group.id,
    name: group.name,
    description: group.description,
    imageUrl: group.imageUrl,
    createdBy: group.createdBy,
    members: memberships.map(m => {
      const u = userMap[m.userId];
      return { id: u?.id, name: u?.name, email: u?.email, avatarUrl: u?.avatarUrl, role: m.role, joinedAt: m.joinedAt.toISOString() };
    }),
    createdAt: group.createdAt.toISOString(),
  });
});

router.delete("/groups/:groupId", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const member = await assertMember(groupId, req.user!.userId);
  if (!member || member.role !== "admin") {
    res.status(403).json({ error: "Only admins can delete the group" });
    return;
  }
  await db.delete(groupsTable).where(eq(groupsTable.id, groupId));
  res.sendStatus(204);
});

router.post("/groups/:groupId/invite", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const member = await assertMember(groupId, req.user!.userId);
  if (!member) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const parsed = InviteToGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email } = parsed.data;
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId));
  const [inviter] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));

  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(groupInvitationsTable).values({ groupId, invitedEmail: email, invitedBy: req.user!.userId, token });
  await sendGroupInviteEmail(email, group.name, inviter.name, token);
  res.json({ message: "Invitation sent" });
});

router.get("/groups/invite/accept/:token", async (req, res): Promise<void> => {
  const rawToken = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const [invite] = await db.select().from(groupInvitationsTable).where(
    and(eq(groupInvitationsTable.token, rawToken), eq(groupInvitationsTable.status, "pending"))
  );
  if (!invite) {
    res.status(400).json({ error: "Invalid or expired invitation" });
    return;
  }

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, invite.invitedEmail));
  if (!existingUser) {
    res.status(400).json({ error: "Please create an account first, then use this link" });
    return;
  }

  const existing = await assertMember(invite.groupId, existingUser.id);
  if (!existing) {
    await db.insert(groupMembersTable).values({ groupId: invite.groupId, userId: existingUser.id, role: "member" });
    await logActivity(invite.groupId, existingUser.id, "member_joined", `${existingUser.name} joined the group`);
  }
  await db.update(groupInvitationsTable).set({ status: "accepted" }).where(eq(groupInvitationsTable.id, invite.id));
  res.json({ message: "Joined group successfully" });
});

router.delete("/groups/:groupId/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const targetUserId = parseId(req.params.userId);
  const member = await assertMember(groupId, req.user!.userId);
  if (!member || member.role !== "admin") {
    res.status(403).json({ error: "Only admins can remove members" });
    return;
  }
  await db.delete(groupMembersTable).where(
    and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetUserId))
  );
  res.sendStatus(204);
});

router.post("/groups/:groupId/leave", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  await db.delete(groupMembersTable).where(
    and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, req.user!.userId))
  );
  res.json({ message: "Left group" });
});

router.get("/groups/:groupId/balances", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const member = await assertMember(groupId, req.user!.userId);
  if (!member) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const memberships = await db.select().from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  const userIds = memberships.map(m => m.userId);
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  const netMap: Record<number, number> = {};
  for (const uid of userIds) netMap[uid] = 0;

  const expenses = await db.select().from(expensesTable).where(eq(expensesTable.groupId, groupId));
  for (const exp of expenses) {
    const splits = await db.select().from(expenseSplitsTable).where(eq(expenseSplitsTable.expenseId, exp.id));
    netMap[exp.paidBy] = (netMap[exp.paidBy] ?? 0) + Number(exp.amount);
    for (const split of splits) {
      netMap[split.userId] = (netMap[split.userId] ?? 0) - Number(split.amountOwed);
    }
  }

  const settlements = await db.select().from(settlementsTable).where(eq(settlementsTable.groupId, groupId));
  for (const s of settlements) {
    netMap[s.paidBy] = (netMap[s.paidBy] ?? 0) - Number(s.amount);
    netMap[s.paidTo] = (netMap[s.paidTo] ?? 0) + Number(s.amount);
  }

  const balances: Balance[] = userIds.map(uid => ({
    userId: uid,
    name: userMap[uid]?.name ?? "Unknown",
    avatarUrl: userMap[uid]?.avatarUrl ?? null,
    net: Math.round((netMap[uid] ?? 0) * 100) / 100,
  }));

  res.json({
    memberBalances: balances.map(b => ({ userId: b.userId, name: b.name, avatarUrl: b.avatarUrl, balance: b.net })),
    simplifiedDebts: simplifyDebts(balances),
  });
});

router.get("/groups/:groupId/activity", requireAuth, async (req, res): Promise<void> => {
  const groupId = parseId(req.params.groupId);
  const member = await assertMember(groupId, req.user!.userId);
  if (!member) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  const activities = await db.select().from(activityLogTable)
    .where(eq(activityLogTable.groupId, groupId))
    .orderBy(activityLogTable.createdAt)
    .limit(50);

  const userIds = [...new Set(activities.map(a => a.userId))];
  const users = userIds.length ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds)) : [];
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

  res.json(activities.map(a => ({
    id: a.id,
    groupId: a.groupId,
    userId: a.userId,
    userName: userMap[a.userId]?.name ?? "Unknown",
    userAvatarUrl: userMap[a.userId]?.avatarUrl ?? null,
    actionType: a.actionType,
    description: a.description,
    metadata: a.metadata,
    createdAt: a.createdAt.toISOString(),
  })));
});

export default router;
