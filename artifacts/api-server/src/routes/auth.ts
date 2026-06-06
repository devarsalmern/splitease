import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { RegisterBody, LoginBody, ForgotPasswordBody, ResetPasswordBody } from "@workspace/api-zod";
import { signToken, requireAuth } from "../lib/auth";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../lib/email";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, email, password } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString("hex");

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    passwordHash,
    verificationToken,
    currency: "USD",
    emailVerified: false,
  }).returning();

  await sendWelcomeEmail(email, name, verificationToken);

  const token = signToken({ userId: user.id, email: user.email });
  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      currency: user.currency,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      currency: user.currency,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
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

router.get("/auth/verify-email/:token", async (req, res): Promise<void> => {
  const rawToken = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.verificationToken, rawToken));
  if (!user) {
    res.status(400).json({ error: "Invalid verification token" });
    return;
  }
  await db.update(usersTable).set({ emailVerified: true, verificationToken: null }).where(eq(usersTable.id, user.id));
  res.json({ message: "Email verified successfully" });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (user) {
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000);
    await db.update(usersTable).set({ resetToken, resetTokenExpiry }).where(eq(usersTable.id, user.id));
    await sendPasswordResetEmail(email, user.name, resetToken);
  }
  res.json({ message: "If an account with that email exists, a reset link has been sent." });
});

router.post("/auth/reset-password/:token", async (req, res): Promise<void> => {
  const rawToken = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.resetToken, rawToken));
  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.update(usersTable).set({ passwordHash, resetToken: null, resetTokenExpiry: null }).where(eq(usersTable.id, user.id));
  res.json({ message: "Password reset successfully" });
});

export default router;
