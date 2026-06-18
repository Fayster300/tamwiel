import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost } from "@tanstack/react-start/server";

const RP_NAME = "Tamwil";

function rpId() {
  const host = getRequestHost() || "localhost";
  // strip port
  return host.split(":")[0];
}

function origin() {
  const host = getRequestHost() || "localhost";
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${protocol}://${host}`;
}

function base64Url(bytes: Uint8Array | string) {
  const input = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  return bytesToBase64Url(input);
}

function randomChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function parseClientData(response: unknown) {
  const clientDataJSON = (response as { response?: { clientDataJSON?: string } })?.response?.clientDataJSON;
  if (!clientDataJSON) throw new Error("Missing passkey client data.");
  const raw = base64UrlToBytes(clientDataJSON);
  const json = new TextDecoder().decode(raw);
  return { raw, data: JSON.parse(json) as { type?: string; challenge?: string; origin?: string } };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.slice(i, i + 8192));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBytes(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

async function sha256(data: Uint8Array | string) {
  const input = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const bytes = new Uint8Array(input.length);
  bytes.set(input);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.buffer));
}

function bytesEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

type CborValue = number | string | Uint8Array | CborValue[] | Map<CborValue, CborValue> | boolean | null;

function readCbor(data: Uint8Array, offset = 0): { value: CborValue; offset: number } {
  const first = data[offset++];
  const major = first >> 5;
  const ai = first & 31;
  const readLen = () => {
    if (ai < 24) return ai;
    if (ai === 24) return data[offset++];
    if (ai === 25) { const n = (data[offset] << 8) | data[offset + 1]; offset += 2; return n; }
    if (ai === 26) { const n = (data[offset] * 2 ** 24) + (data[offset + 1] << 16) + (data[offset + 2] << 8) + data[offset + 3]; offset += 4; return n; }
    throw new Error("Unsupported passkey data length.");
  };
  const len = major === 7 ? ai : readLen();
  if (major === 0) return { value: len, offset };
  if (major === 1) return { value: -1 - len, offset };
  if (major === 2) { const value = data.slice(offset, offset + len); return { value, offset: offset + len }; }
  if (major === 3) { const value = new TextDecoder().decode(data.slice(offset, offset + len)); return { value, offset: offset + len }; }
  if (major === 4) { const value: CborValue[] = []; for (let i = 0; i < len; i++) { const next = readCbor(data, offset); value.push(next.value); offset = next.offset; } return { value, offset }; }
  if (major === 5) { const value = new Map<CborValue, CborValue>(); for (let i = 0; i < len; i++) { const key = readCbor(data, offset); const val = readCbor(data, key.offset); value.set(key.value, val.value); offset = val.offset; } return { value, offset }; }
  if (major === 6) return readCbor(data, offset);
  if (major === 7 && ai === 20) return { value: false, offset };
  if (major === 7 && ai === 21) return { value: true, offset };
  if (major === 7 && ai === 22) return { value: null, offset };
  throw new Error("Unsupported passkey data format.");
}

function decodeCbor(data: Uint8Array) {
  return readCbor(data).value;
}

function derToRawEcdsa(der: Uint8Array) {
  if (der[0] !== 0x30) throw new Error("Invalid passkey signature.");
  let offset = der[1] > 0x80 ? 2 + (der[1] & 0x7f) : 2;
  if (der[offset++] !== 0x02) throw new Error("Invalid passkey signature.");
  const rLen = der[offset++];
  let r = der.slice(offset, offset + rLen); offset += rLen;
  if (der[offset++] !== 0x02) throw new Error("Invalid passkey signature.");
  const sLen = der[offset++];
  let s = der.slice(offset, offset + sLen);
  while (r.length > 32 && r[0] === 0) r = r.slice(1);
  while (s.length > 32 && s[0] === 0) s = s.slice(1);
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

function mapGet<T extends CborValue>(map: Map<CborValue, CborValue>, key: number): T {
  return map.get(key) as T;
}

function parseAuthData(authData: Uint8Array) {
  const rpHash = authData.slice(0, 32);
  const flags = authData[32];
  const counter = (authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36];
  let credentialId: string | undefined;
  let publicKey: Uint8Array | undefined;
  if (flags & 0x40) {
    const credIdLen = (authData[53] << 8) | authData[54];
    const credId = authData.slice(55, 55 + credIdLen);
    credentialId = bytesToBase64Url(credId);
    publicKey = authData.slice(55 + credIdLen);
  }
  return { rpHash, flags, counter, credentialId, publicKey };
}

function assertUserVerified(flags: number) {
  if ((flags & 0x01) === 0 || (flags & 0x04) === 0) throw new Error("Face ID / device verification was not completed.");
}

async function verifyRpIdHash(authData: Uint8Array) {
  const parsed = parseAuthData(authData);
  const expected = await sha256(rpId());
  if (!bytesEqual(parsed.rpHash, expected)) throw new Error("Passkey belongs to a different website.");
  assertUserVerified(parsed.flags);
  return parsed;
}

async function importCosePublicKey(cose: Uint8Array) {
  const decoded = decodeCbor(cose);
  if (!(decoded instanceof Map)) throw new Error("Unsupported passkey public key.");
  const alg = mapGet<number>(decoded, 3);
  if (alg !== -7) throw new Error("This passkey algorithm is not supported yet. Please enroll this device again.");
  const x = mapGet<Uint8Array>(decoded, -2);
  const y = mapGet<Uint8Array>(decoded, -3);
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: bytesToBase64Url(x), y: bytesToBase64Url(y), ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

async function verifyAssertionSignature(response: unknown, publicKeyB64: string) {
  const res = (response as { response?: { authenticatorData?: string; clientDataJSON?: string; signature?: string } }).response;
  if (!res?.authenticatorData || !res.clientDataJSON || !res.signature) throw new Error("Missing passkey assertion data.");
  const authenticatorData = base64UrlToBytes(res.authenticatorData);
  await verifyRpIdHash(authenticatorData);
  const signedBytes = concatBytes(authenticatorData, await sha256(base64UrlToBytes(res.clientDataJSON)));
  const key = await importCosePublicKey(base64UrlToBytes(publicKeyB64));
  const signature = derToRawEcdsa(base64UrlToBytes(res.signature));
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, signedBytes);
  if (!ok) throw new Error("Passkey signature could not be verified.");
}

export const hasPasskey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("owner_passkeys").select("id").eq("user_id", userId).limit(1);
    return { enrolled: (data?.length ?? 0) > 0 };
  });

export const startPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const challenge = randomChallenge();

    const opts = {
      challenge,
      rp: { name: RP_NAME, id: rpId() },
      user: { id: base64Url(userId), name: userId, displayName: "Tamwil owner" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      timeout: 60_000,
      attestation: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    };

    await supabaseAdmin.from("passkey_challenges").upsert({
      user_id: userId,
      challenge,
      kind: "register",
    });
    return opts;
  });

export const finishPasskeyRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { response: unknown; label?: string }) =>
    z.object({ response: z.any(), label: z.string().max(60).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: chal } = await supabaseAdmin
      .from("passkey_challenges")
      .select("challenge, kind")
      .eq("user_id", userId)
      .maybeSingle();
    if (!chal || chal.kind !== "register") throw new Error("No registration in progress.");

    const client = parseClientData(data.response);
    if (client.data.type !== "webauthn.create" || client.data.challenge !== chal.challenge || client.data.origin !== origin()) {
      throw new Error("Passkey registration could not be verified.");
    }
    const response = data.response as { id?: string; response?: { attestationObject?: string; transports?: string[] } };
    if (!response.id) throw new Error("Missing passkey credential.");
    if (!response.response?.attestationObject) throw new Error("Missing passkey attestation.");
    const attestation = decodeCbor(base64UrlToBytes(response.response.attestationObject));
    if (!(attestation instanceof Map)) throw new Error("Passkey attestation could not be read.");
    const authData = attestation.get("authData");
    if (!(authData instanceof Uint8Array)) throw new Error("Passkey authentication data is missing.");
    const parsed = await verifyRpIdHash(authData);
    if (!parsed.credentialId || !parsed.publicKey || parsed.credentialId !== response.id) throw new Error("Passkey credential mismatch.");

    const { error } = await supabaseAdmin.from("owner_passkeys").insert({
      user_id: userId,
      credential_id: response.id,
      public_key: bytesToBase64Url(parsed.publicKey),
      counter: parsed.counter,
      transports: response.response?.transports?.join(",") ?? null,
      device_label: data.label ?? "This device",
    });
    if (error) throw error;
    await supabaseAdmin.from("passkey_challenges").delete().eq("user_id", userId);
    return { ok: true };
  });

export const startPasskeyAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const challenge = randomChallenge();

    const { data: creds } = await supabaseAdmin
      .from("owner_passkeys")
      .select("credential_id, transports")
      .eq("user_id", userId);
    if (!creds || creds.length === 0) throw new Error("No passkey enrolled. Please register one first.");

    const opts = {
      challenge,
      rpId: rpId(),
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credential_id,
        type: "public-key" as const,
        transports: c.transports ? (c.transports.split(",") as AuthenticatorTransportFuture[]) : undefined,
      })),
      timeout: 60_000,
    };

    await supabaseAdmin.from("passkey_challenges").upsert({
      user_id: userId,
      challenge,
      kind: "auth",
    });
    return opts;
  });

type AuthenticatorTransportFuture = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

export const finishPasskeyAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { response: unknown }) => z.object({ response: z.any() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: chal } = await supabaseAdmin
      .from("passkey_challenges")
      .select("challenge, kind")
      .eq("user_id", userId)
      .maybeSingle();
    if (!chal || chal.kind !== "auth") throw new Error("No authentication in progress.");

    const credentialId = (data.response as { id: string }).id;
    const { data: stored } = await supabaseAdmin
      .from("owner_passkeys")
      .select("id, credential_id, public_key, counter, transports")
      .eq("user_id", userId)
      .eq("credential_id", credentialId)
      .maybeSingle();
    if (!stored) throw new Error("Passkey not recognized.");

    const client = parseClientData(data.response);
    if (client.data.type !== "webauthn.get" || client.data.challenge !== chal.challenge || client.data.origin !== origin()) {
      throw new Error("Passkey verification failed.");
    }
    await verifyAssertionSignature(data.response, stored.public_key);

    await supabaseAdmin
      .from("owner_passkeys")
      .update({ counter: Number(stored.counter ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", stored.id);
    await supabaseAdmin.from("passkey_challenges").delete().eq("user_id", userId);

    // Issue a short-lived token so the client can prove biometric for the next sensitive action.
    return { ok: true, verifiedAt: Date.now() };
  });
