import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fingerprint, ScanFace, Loader2, X, Check } from "lucide-react";
import { toast } from "sonner";
import {
  hasPasskey,
  startPasskeyRegistration,
  finishPasskeyRegistration,
  startPasskeyAuth,
  finishPasskeyAuth,
} from "@/lib/passkeys.functions";

export function usePasskey() {
  return useQuery({
    queryKey: ["passkey"],
    queryFn: async () => {
      const fn = hasPasskey;
      return await fn();
    },
  });
}

export async function registerPasskey() {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const startFn = startPasskeyRegistration;
  const finishFn = finishPasskeyRegistration;
  const opts = await startFn();
  const att = await startRegistration({ optionsJSON: opts as Parameters<typeof startRegistration>[0]["optionsJSON"] });
  await finishFn({ data: { response: att, label: navigator.userAgent.slice(0, 40) } });
}

export async function verifyPasskey() {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const startFn = startPasskeyAuth;
  const finishFn = finishPasskeyAuth;
  const opts = await startFn();
  const ass = await startAuthentication({ optionsJSON: opts as Parameters<typeof startAuthentication>[0]["optionsJSON"] });
  await finishFn({ data: { response: ass } });
}

export function PasskeyGate({
  open,
  title,
  detail,
  onSuccess,
  onClose,
}: {
  open: boolean;
  title: string;
  detail?: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const { data: pk } = usePasskey();
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  if (!open) return null;
  const enrolled = pk?.enrolled ?? false;

  async function doEnroll() {
    setBusy(true);
    try {
      await registerPasskey();
      toast.success("Face ID / Touch ID enrolled");
      qc.invalidateQueries({ queryKey: ["passkey"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enroll passkey");
    } finally {
      setBusy(false);
    }
  }

  async function doAuth() {
    setBusy(true);
    try {
      await verifyPasskey();
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
      <div className="glass rounded-3xl w-full max-w-sm p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 size-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
          <X className="size-4" />
        </button>
        <div className="size-14 rounded-2xl bg-neon shadow-glow flex items-center justify-center mx-auto mb-3">
          <ScanFace className="size-7 text-primary-foreground" />
        </div>
        <h3 className="text-lg font-bold text-center">{title}</h3>
        {detail && <p className="text-xs text-muted-foreground text-center mt-1">{detail}</p>}

        {!enrolled ? (
          <>
            <p className="text-sm text-center mt-4">
              You haven't enrolled a passkey yet. Use your device's Face ID, Touch ID, or Windows Hello to secure auto-pay.
            </p>
            <button
              onClick={doEnroll}
              disabled={busy}
              className="w-full mt-5 px-4 py-2.5 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
              {busy ? "Enrolling…" : "Enroll Face ID / Touch ID"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-center mt-4">Please verify with your device biometric to continue.</p>
            <button
              onClick={doAuth}
              disabled={busy}
              className="w-full mt-5 px-4 py-2.5 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {busy ? "Verifying…" : "Verify"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
