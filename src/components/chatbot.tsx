import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askBola } from "@/lib/ai.functions";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

export function BolaChatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm Pecunia, your family finance buddy. Ask me anything about budgeting, saving, or your spending — I'll keep it simple.",
    },
  ]);

  const ask = useServerFn(askBola);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await ask({
        data: { messages: next.filter((m) => m.role !== "assistant" || msgs.indexOf(m) !== 0) },
      });
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 group flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-neon text-primary-foreground shadow-glow hover:scale-105 transition animate-pulse-glow"
          aria-label="Open Pecunia chatbot"
        >
          <div className="size-8 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
            P
          </div>
          <div className="text-left leading-tight">
            <div className="text-sm font-bold">Pecunia</div>
            <div className="text-[10px] opacity-80">Ask me anything</div>
          </div>

          <MessageCircle className="size-4 ml-1" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-4rem))] glass rounded-3xl flex flex-col overflow-hidden border border-primary/30 shadow-glow">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-neon text-primary-foreground">
            <div className="size-10 rounded-full bg-white/25 flex items-center justify-center text-xl font-bold">
              P
            </div>
            <div className="flex-1 leading-tight">
              <div className="font-bold">Pecunia</div>
              <div className="text-[11px] opacity-85">Your family finance helper</div>

            </div>
            <button
              onClick={() => setOpen(false)}
              className="size-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
              aria-label="Close chat"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-neon text-primary-foreground rounded-br-md"
                      : "bg-white/8 border border-white/10 rounded-bl-md"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> بولا is thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="p-3 border-t border-white/10 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Bola about your money…"
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-sm outline-none focus:border-primary/60"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="size-10 rounded-full bg-neon text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:scale-105 transition shadow-glow"
              aria-label="Send"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
