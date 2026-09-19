import { Resend } from "resend";

/**
 * Resend email delivery for the forgot-password flow — the only real
 * (non-mocked) email sender in the app. Framework-independent (no Next.js
 * imports) per lib/ conventions, mirroring lib/sms/msg91.ts's shape.
 */

let client: Resend | null = null;

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Resend is not configured — missing RESEND_API_KEY.");
  }
  if (!client) client = new Resend(apiKey);
  return client;
}

/** True when RESEND_API_KEY is present. Never throws — callers use this to fail cleanly before attempting a send. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function resetPasswordHtml(resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <h1 style="font-size: 20px; margin-bottom: 16px;">Reset your Mentis password</h1>
      <p style="font-size: 14px; line-height: 1.6;">
        We received a request to reset the password for your Mentis account.
        Click the button below to choose a new one. This link expires in 1 hour.
      </p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Reset password
        </a>
      </p>
      <p style="font-size: 12px; color: #6b7280; line-height: 1.6;">
        If you didn't request this, you can safely ignore this email — your password will not be changed.
      </p>
    </div>
  `;
}

/**
 * Sends the forgot-password email. Throws if Resend isn't configured or the
 * send fails — callers should let this propagate rather than falsely
 * confirming an email that was never sent.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const from = process.env.EMAIL_FROM || "Mentis <onboarding@resend.dev>";

  const { error } = await getClient().emails.send({
    from,
    to,
    subject: "Reset your Mentis password",
    html: resetPasswordHtml(resetUrl),
  });

  if (error) {
    throw new Error(`Resend email send failed: ${error.message}`);
  }
}
