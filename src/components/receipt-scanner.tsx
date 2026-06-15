import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { scanReceipt } from "@/lib/ai.functions";
import { addExpense } from "@/lib/household.functions";
import { Camera, Loader2, X, Check, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Money } from "@/components/dh";

type Item = { name: string; amount: number; category: string; include: boolean };

const CATS = ["Food", "Rent", "Utilities", "Transport", "Entertainment", "Education", "Shopping", "Health"];

export function ReceiptScanner() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [merchant, setMerchant] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const scan = useServerFn(scanReceipt);
  const addExp = useServerFn(addExpense);
  const qc = useQueryClient();

  function pick() {
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) return toast.error("File too big (max 8 MB).");
    setBusy(true);
    setItems([]);
    setMerchant("");
    setOpen(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      const res = await scan({ data: { image_base64: b64, mime_type: f.type || "image/jpeg" } });
      setMerchant(res.merchant);
      setItems(
        res.items.map((i) => ({
          name: i.name,
          amount: i.amount,
          category: CATS.includes(i.category) ? i.category : "Shopping",
          include: true,
        })),
      );
      if (res.items.length === 0) toast.message("No items found", { description: "Try a clearer photo." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
      setOpen(false);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveAll() {
    const picked = items.filter((i) => i.include && i.amount > 0);
    if (!picked.length) return toast.error("Select at least one item.");
    setBusy(true);
    try {
      for (const it of picked) {
        await addExp({
          data: {
            merchant: `${merchant} · ${it.name}`.slice(0, 120),
            amount: Number(it.amount.toFixed(2)),
            category: it.category,
          },
        });
      }
      toast.success(`${picked.length} item${picked.length > 1 ? "s" : ""} added`);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  function update(i: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeItem(i: number) {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  }

  const total = items.filter((i) => i.include).reduce((a, b) => a + (Number(b.amount) || 0), 0);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={onFile}
        className="hidden"
      />
      <button
        onClick={pick}
        className="px-4 py-2 rounded-lg bg-aurora text-primary-foreground text-sm font-semibold shadow-glow hover:scale-105 transition flex items-center gap-2"
      >
        <Camera className="size-4" /> Scan receipt
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/70 backdrop-blur-md">
          <div className="glass rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-primary/30">
            <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">AI receipt scan</div>
                <div className="text-lg font-bold">{merchant || "Scanning…"}</div>
              </div>
              <button onClick={() => setOpen(false)} className="size-9 rounded-lg hover:bg-white/10 flex items-center justify-center">
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {busy && items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <div className="text-sm">Reading your receipt…</div>
                </div>
              )}
              {!busy && items.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  No items extracted. Try another photo.
                </div>
              )}
              {items.map((it, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[auto_1fr_120px_120px_auto] gap-2 items-center p-2.5 rounded-xl border ${
                    it.include ? "bg-white/[0.04] border-white/10" : "bg-white/[0.01] border-white/5 opacity-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={it.include}
                    onChange={(e) => update(i, { include: e.target.checked })}
                    className="size-4 accent-primary"
                  />
                  <input
                    value={it.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    className="bg-transparent text-sm outline-none px-2 py-1 rounded border border-transparent focus:border-primary/40"
                  />
                  <select
                    value={it.category}
                    onChange={(e) => update(i, { category: e.target.value })}
                    className="bg-white/5 text-xs rounded px-2 py-1 border border-white/10 outline-none"
                  >
                    {CATS.map((c) => (
                      <option key={c} value={c} className="bg-background">
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    value={it.amount}
                    onChange={(e) => update(i, { amount: parseFloat(e.target.value) || 0 })}
                    inputMode="decimal"
                    className="bg-white/5 text-sm text-right rounded px-2 py-1 border border-white/10 outline-none font-mono"
                  />
                  <button onClick={() => removeItem(i)} className="size-8 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <footer className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total to add</div>
                <div className="text-xl font-bold text-gradient"><Money amount={total} /></div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={pick} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm flex items-center gap-1.5">
                  <Upload className="size-3.5" /> New photo
                </button>
                <button
                  onClick={saveAll}
                  disabled={busy || items.filter((i) => i.include).length === 0}
                  className="px-4 py-2 rounded-lg bg-neon text-primary-foreground text-sm font-semibold shadow-glow disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Check className="size-4" />
                  {busy ? "Saving…" : `Add ${items.filter((i) => i.include).length} item${items.filter((i) => i.include).length === 1 ? "" : "s"}`}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
