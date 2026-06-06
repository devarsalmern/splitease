import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { UpdateProfileBody, ChangePasswordBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    currency: user.currency,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  });
});

router.put("/users/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.currency !== undefined) updates.currency = parsed.data.currency;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.user!.userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    currency: user.currency,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  });
});

router.put("/users/change-password", requireAuth, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  res.json({ message: "Password changed successfully" });
});

export default router;
