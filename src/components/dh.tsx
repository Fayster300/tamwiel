import dhAsset from "@/assets/dh.png.asset.json";
import { useProfile } from "@/lib/use-profile";
import { currencySymbol } from "@/lib/currency";

/**
 * Renders the household's currency symbol. For AED it uses the Dh image
 * (matching the local UAE Dirham brand); for every other currency it
 * renders the appropriate text symbol (₹, $, ﷼, €, …).
 */
export function Dh({ className = "" }: { className?: string }) {
  const { data: profile } = useProfile();
  const currency = profile?.household?.currency ?? "AED";

  if (currency === "AED") {
    return (
      <img
        src={dhAsset.url}
        alt="AED"
        aria-label="AED"
        className={`inline-block align-[-0.12em] h-[0.95em] w-auto select-none pointer-events-none ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <span aria-label={currency} className={`inline-block font-semibold ${className}`}>
      {currencySymbol(currency)}
    </span>
  );
}

/** Render a currency amount: <symbol> 1,234.56 with optional sign prefix. */
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
