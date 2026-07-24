/**
 * MSG91 SMS delivery for customer OTP — the only real (non-mocked) piece of
 * the OTP flow. Framework-independent (no Next.js imports) per lib/
 * conventions; the DLT-approved template text lives here since it must match
 * MSG91_DLT_TEMPLATE_ID exactly.
 */

const OTP_TEMPLATE = (otp: string) =>
  `Use OTP ${otp} for BYB Mart registration. Please share the OTP only with our BYB Mart personnel.`;

/** MSG91's sendhttp.php expects the mobile with country code, no "+". Indian 10-digit numbers get "91" prepended; anything already longer is passed through as-is. */
function toMsg91Mobile(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Sends the OTP over SMS via MSG91. Throws if config is missing or MSG91
 * reports/returns a failure — callers should let this propagate so a
 * customer who didn't receive a code sees an error instead of a false
 * "sent" confirmation.
 */
export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;
  const route = process.env.MSG91_ROUTE;
  const templateId = process.env.MSG91_DLT_TEMPLATE_ID;
  const apiUrl = process.env.MSG91_API_URL;

  if (!authKey || !senderId || !route || !templateId || !apiUrl) {
    throw new Error("MSG91 is not configured — missing one or more MSG91_* environment variables.");
  }

  const mobile = toMsg91Mobile(phone);
  const message = OTP_TEMPLATE(otp);

  const params = new URLSearchParams({
    authkey: authKey,
    mobiles: mobile,
    message,
    sender: senderId,
    route,
    country: "91",
    DLT_TE_ID: templateId,
  });

  const url = `${apiUrl}?${params.toString()}`;
  const maskedAuthKey = `${authKey.slice(0, 4)}...${authKey.slice(-4)}`;

  console.log(`[msg91] Sending to ${mobile}: "${message}"`);
  console.log(
    `[msg91] Request: sender=${senderId} route=${route} DLT_TE_ID=${templateId} authkey=${maskedAuthKey} url=${url.replace(authKey, maskedAuthKey)}`
  );

  const res = await fetch(url, { method: "GET" });
  const body = await res.text();

  console.log(`[msg91] Response (HTTP ${res.status}): ${body}`);

  // sendhttp.php has no structured response — a success returns a message
  // ID, a failure returns a string containing an error description.
  if (!res.ok || /error/i.test(body)) {
    throw new Error(`MSG91 SMS send failed: ${body}`);
  }
}
