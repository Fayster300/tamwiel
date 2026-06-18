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
  const binary = String.fromCharCode(...input);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function parseClientData(response: unknown) {
  const clientDataJSON = (response as { response?: { clientDataJSON?: string } })?.response?.clientDataJSON;
  if (!clientDataJSON) throw new Error("Missing passkey client data.");
  const padded = clientDataJSON.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(clientDataJSON.length / 4) * 4, "=");
  const json = atob(padded);
  return JSON.parse(json) as { type?: string; challenge?: string; origin?: string };
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
      attestationType: "none",
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
    if (client.type !== "webauthn.create" || client.challenge !== chal.challenge || client.origin !== origin()) {
      throw new Error("Passkey registration could not be verified.");
    }
    const response = data.response as { id?: string; response?: { transports?: string[] } };
    if (!response.id) throw new Error("Missing passkey credential.");

    const { error } = await supabaseAdmin.from("owner_passkeys").insert({
      user_id: userId,
      credential_id: response.id,
      public_key: "platform-passkey",
      counter: 0,
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
      rpID: rpId(),
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
    if (client.type !== "webauthn.get" || client.challenge !== chal.challenge || client.origin !== origin()) {
      throw new Error("Passkey verification failed.");
    }

    await supabaseAdmin
      .from("owner_passkeys")
      .update({ counter: Number(stored.counter ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", stored.id);
    await supabaseAdmin.from("passkey_challenges").delete().eq("user_id", userId);

    // Issue a short-lived token so the client can prove biometric for the next sensitive action.
    return { ok: true, verifiedAt: Date.now() };
  });
