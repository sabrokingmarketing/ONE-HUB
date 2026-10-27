/**
 * Verifies a Resend webhook request. Resend signs webhooks with Svix:
 *   signed content = `${svix-id}.${svix-timestamp}.${rawBody}`
 *   signature      = base64(HMAC-SHA256(base64decode(secret without "whsec_"), signed content))
 *   svix-signature = space-separated list of "v1,<signature>" entries (any may match)
 * Requests older or newer than five minutes are rejected to stop replays.
 */
const TOLERANCE_S = 5 * 60;

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToB64(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signWebhook(secret: string, id: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    b64ToBytes(secret.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToB64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)));
}

export async function verifyWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  nowMs = Date.now(),
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > TOLERANCE_S) return false;
  let expected: string;
  try {
    expected = await signWebhook(secret, id, timestamp, body);
  } catch {
    return false;
  }
  return signature
    .split(" ")
    .map((s) => s.split(",", 2))
    .some(([version, sig]) => version === "v1" && !!sig && timingSafeEqual(sig, expected));
}
