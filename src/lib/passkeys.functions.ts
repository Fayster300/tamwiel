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
    const { generateRegistrationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const opts = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpId(),
      userID: new TextEncoder().encode(userId),
      userName: userId,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    });

    await supabaseAdmin.from("passkey_challenges").upsert({
      user_id: userId,
      challenge: opts.challenge,
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
    const { verifyRegistrationResponse } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: chal } = await supabaseAdmin
      .from("passkey_challenges")
      .select("challenge, kind")
      .eq("user_id", userId)
      .maybeSingle();
    if (!chal || chal.kind !== "register") throw new Error("No registration in progress.");

    const verification = await verifyRegistrationResponse({
      response: data.response as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: chal.challenge,
      expectedOrigin: origin(),
      expectedRPID: rpId(),
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) throw new Error("Registration failed.");

    const reg = verification.registrationInfo;
    // simplewebauthn v13 shape:
    const cred = (reg as unknown as { credential: { id: string; publicKey: Uint8Array; counter: number } }).credential;

    const publicKeyB64 = Buffer.from(cred.publicKey).toString("base64");

    const { error } = await supabaseAdmin.from("owner_passkeys").insert({
      user_id: userId,
      credential_id: cred.id,
      public_key: publicKeyB64,
      counter: cred.counter,
      device_label: data.label ?? "This device",
    });
    if (error) throw error;
    await supabaseAdmin.from("passkey_challenges").delete().eq("user_id", userId);
    return { ok: true };
  });

export const startPasskeyAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { generateAuthenticationOptions } = await import("@simplewebauthn/server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: creds } = await supabaseAdmin
      .from("owner_passkeys")
      .select("credential_id, transports")
      .eq("user_id", userId);
    if (!creds || creds.length === 0) throw new Error("No passkey enrolled. Please register one first.");

    const opts = await generateAuthenticationOptions({
      rpID: rpId(),
      userVerification: "required",
      allowCredentials: creds.map((c) => ({
        id: c.credential_id,
        transports: c.transports ? (c.transports.split(",") as AuthenticatorTransportFuture[]) : undefined,
      })),
    });

    await supabaseAdmin.from("passkey_challenges").upsert({
      user_id: userId,
      challenge: opts.challenge,
      kind: "auth",
    });
    return opts;
  });

type AuthenticatorTransportFuture = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

export const finishPasskeyAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { response: unknown }) => z.object({ response: z.any() }).parse(d))
  .handler(async ({ data, context }) => {
    const { verifyAuthenticationResponse } = await import("@simplewebauthn/server");
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

    const verification = await verifyAuthenticationResponse({
      response: data.response as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: chal.challenge,
      expectedOrigin: origin(),
      expectedRPID: rpId(),
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(Buffer.from(stored.public_key, "base64")),
        counter: Number(stored.counter),
        transports: stored.transports ? (stored.transports.split(",") as AuthenticatorTransportFuture[]) : undefined,
      },
      requireUserVerification: true,
    });
    if (!verification.verified) throw new Error("Verification failed.");

    await supabaseAdmin
      .from("owner_passkeys")
      .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
      .eq("id", stored.id);
    await supabaseAdmin.from("passkey_challenges").delete().eq("user_id", userId);

    // Issue a short-lived token so the client can prove biometric for the next sensitive action.
    return { ok: true, verifiedAt: Date.now() };
  });
