import dhAsset from "@/assets/dh.png.asset.json";

/** Inline UAE Dirham (Dh) symbol image. Sized to match surrounding text via em units. */
export function Dh({ className = "" }: { className?: string }) {
  return (
    <img
      src={dhAsset.url}
      alt="Dh"
      aria-label="Dh"
      className={`inline-block align-[-0.12em] h-[0.95em] w-auto select-none pointer-events-none ${className}`}
      draggable={false}
    />
  );
}

/** Render a currency amount: <Dh /> 1,234.56 with optional sign prefix. */
export function Money({
  amount,
  decimals = 2,
  sign,
  className = "",
}: {
  amount: number;
  decimals?: number;
  sign?: "+" | "-";
  className?: string;
}) {
  const formatted = Number(amount).toFixed(decimals);
  return (
    <span className={`inline-flex items-baseline gap-1 ${className}`}>
      {sign}
      <Dh />
      <span>{formatted}</span>
    </span>
  );
}
