import nodemailer from "nodemailer";
import { logger } from "./logger";

const EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@splitease.app";
const APP_URL = process.env.APP_URL ?? "http://localhost:8080";

function createTransport() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  logger.warn("No SMTP_HOST configured — email sending is disabled");
  return null;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const transport = createTransport();
  if (!transport) return;
  try {
    await transport.sendMail({ from: EMAIL_FROM, to, subject, html });
    logger.info({ to, subject }, "Email sent");
  } catch (err) {
    logger.error({ err, to, subject }, "Failed to send email");
  }
}

function emailTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Inter,Helvetica,Arial,sans-serif;background:#f4f4f5;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#10B981;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">SplitEase</h1>
    </div>
    <div style="padding:32px">
      <h2 style="color:#111827;margin:0 0 16px;font-size:20px">${title}</h2>
      ${body}
    </div>
    <div style="background:#f9fafb;padding:20px 32px;text-align:center;color:#6b7280;font-size:13px">
      © 2025 SplitEase · Split expenses with friends
    </div>
  </div>
</body>
</html>`;
}

export async function sendWelcomeEmail(to: string, name: string, verificationToken: string): Promise<void> {
  const link = `${APP_URL}/api/auth/verify-email/${verificationToken}`;
  await sendEmail(to, "Welcome to SplitEase — verify your email", emailTemplate(
    `Welcome, ${name}!`,
    `<p style="color:#374151;line-height:1.6">Thanks for joining SplitEase. Please verify your email address to get started.</p>
    <a href="${link}" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:8px">Verify Email</a>`
  ));
}

export async function sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<void> {
  const link = `${APP_URL}/api/auth/reset-password/${resetToken}`;
  await sendEmail(to, "Reset your SplitEase password", emailTemplate(
    "Password Reset",
    `<p style="color:#374151;line-height:1.6">Hi ${name}, click below to reset your password. This link expires in 1 hour.</p>
    <a href="${link}" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:8px">Reset Password</a>
    <p style="color:#6b7280;font-size:13px;margin-top:16px">If you didn't request this, you can safely ignore this email.</p>`
  ));
}

export async function sendGroupInviteEmail(to: string, groupName: string, inviterName: string, token: string): Promise<void> {
  const link = `${APP_URL}/api/groups/invite/accept/${token}`;
  await sendEmail(to, `${inviterName} invited you to ${groupName} on SplitEase`, emailTemplate(
    `You've been invited to ${groupName}`,
    `<p style="color:#374151;line-height:1.6">${inviterName} has invited you to join the group <strong>${groupName}</strong> on SplitEase.</p>
    <a href="${link}" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:8px">Accept Invitation</a>`
  ));
}

export async function sendExpenseNotificationEmail(
  to: string,
  recipientName: string,
  action: "added" | "updated" | "deleted",
  expenseTitle: string,
  amount: number,
  currency: string,
  groupName: string,
  actorName: string
): Promise<void> {
  const titles: Record<string, string> = {
    added: `New expense in ${groupName}`,
    updated: `Expense updated in ${groupName}`,
    deleted: `Expense deleted in ${groupName}`,
  };
  const actions: Record<string, string> = {
    added: `added a new expense`,
    updated: `updated an expense`,
    deleted: `deleted an expense`,
  };
  await sendEmail(to, titles[action], emailTemplate(
    titles[action],
    `<p style="color:#374151;line-height:1.6">Hi ${recipientName}, <strong>${actorName}</strong> ${actions[action]} <strong>${expenseTitle}</strong> (${currency} ${amount.toFixed(2)}) in <strong>${groupName}</strong>.</p>
    <a href="${APP_URL}" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:8px">View in App</a>`
  ));
}

export async function sendSettlementEmail(
  to: string,
  recipientName: string,
  payerName: string,
  payeeName: string,
  amount: number,
  currency: string,
  groupName: string
): Promise<void> {
  await sendEmail(to, `${payerName} settled up in ${groupName}`, emailTemplate(
    "Settlement Recorded",
    `<p style="color:#374151;line-height:1.6">Hi ${recipientName}, <strong>${payerName}</strong> paid <strong>${payeeName}</strong> ${currency} ${amount.toFixed(2)} in <strong>${groupName}</strong>.</p>
    <a href="${APP_URL}" style="display:inline-block;background:#10B981;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;margin-top:8px">View in App</a>`
  ));
}
