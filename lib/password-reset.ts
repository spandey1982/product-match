import { randomBytes, createHash } from "crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

/**
 * Forgot-password token issuance/consumption for logged-out users — distinct
 * from lib/retailer-otp.ts (which is SMS-based and requires an existing
 * authenticated session + a verified phone, neither of which a locked-out
 * user has). Kept out of lib/auth.ts itself to keep that file's surface
 * limited to session/credential primitives; this file only depends on its
 * exported hashPassword.
 *
 * The raw token is only ever held in memory and in the emailed link — the DB
 * stores just its SHA-256 hash (User.passwordResetTokenHash), so a database
 * leak alone can never be used to reset an account's password.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a fresh reset token for the given user, overwriting any
 * previously pending one (so only the most recently requested link works).
 * Returns the raw token — the caller builds the emailed URL from it.
 */
export async function issuePasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.user.update({
    where: { id: userId },
    data: {
      passwordResetTokenHash: hashToken(token),
      passwordResetExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return token;
}

/**
 * Verifies a raw token against the stored hash + expiry, and — only if
 * valid — sets the new password and clears the token (single-use). Returns
 * the user id on success, or null for an invalid/expired/already-used token.
 */
export async function consumePasswordResetToken(
  token: string,
  newPassword: string
): Promise<{ id: string; email: string; name: string; role: string; storeName: string | null; businessType: string } | null> {
  const user = await db.user.findUnique({ where: { passwordResetTokenHash: hashToken(token) } });

  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
    return null;
  }

  const hashedPassword = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    storeName: user.storeName,
    businessType: user.businessType,
  };
}
