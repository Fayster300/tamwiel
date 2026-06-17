// Country → currency mapping (ISO 4217). One currency per household.
export type CurrencyCode = string;

export interface CountryEntry {
  name: string;
  code: string; // ISO 3166-1 alpha-2
  currency: CurrencyCode;
  flag: string; // emoji
}

// Curated, broad coverage. Sorted alphabetically by name.
export const COUNTRIES: CountryEntry[] = [
  { name: "Argentina", code: "AR", currency: "ARS", flag: "🇦🇷" },
  { name: "Australia", code: "AU", currency: "AUD", flag: "🇦🇺" },
  { name: "Bahrain", code: "BH", currency: "BHD", flag: "🇧🇭" },
  { name: "Bangladesh", code: "BD", currency: "BDT", flag: "🇧🇩" },
  { name: "Brazil", code: "BR", currency: "BRL", flag: "🇧🇷" },
  { name: "Canada", code: "CA", currency: "CAD", flag: "🇨🇦" },
  { name: "China", code: "CN", currency: "CNY", flag: "🇨🇳" },
  { name: "Egypt", code: "EG", currency: "EGP", flag: "🇪🇬" },
  { name: "France", code: "FR", currency: "EUR", flag: "🇫🇷" },
  { name: "Germany", code: "DE", currency: "EUR", flag: "🇩🇪" },
  { name: "Hong Kong", code: "HK", currency: "HKD", flag: "🇭🇰" },
  { name: "India", code: "IN", currency: "INR", flag: "🇮🇳" },
  { name: "Indonesia", code: "ID", currency: "IDR", flag: "🇮🇩" },
  { name: "Italy", code: "IT", currency: "EUR", flag: "🇮🇹" },
  { name: "Japan", code: "JP", currency: "JPY", flag: "🇯🇵" },
  { name: "Jordan", code: "JO", currency: "JOD", flag: "🇯🇴" },
  { name: "Kuwait", code: "KW", currency: "KWD", flag: "🇰🇼" },
  { name: "Malaysia", code: "MY", currency: "MYR", flag: "🇲🇾" },
  { name: "Mexico", code: "MX", currency: "MXN", flag: "🇲🇽" },
  { name: "Morocco", code: "MA", currency: "MAD", flag: "🇲🇦" },
  { name: "Netherlands", code: "NL", currency: "EUR", flag: "🇳🇱" },
  { name: "New Zealand", code: "NZ", currency: "NZD", flag: "🇳🇿" },
  { name: "Nigeria", code: "NG", currency: "NGN", flag: "🇳🇬" },
  { name: "Norway", code: "NO", currency: "NOK", flag: "🇳🇴" },
  { name: "Oman", code: "OM", currency: "OMR", flag: "🇴🇲" },
  { name: "Pakistan", code: "PK", currency: "PKR", flag: "🇵🇰" },
  { name: "Philippines", code: "PH", currency: "PHP", flag: "🇵🇭" },
  { name: "Poland", code: "PL", currency: "PLN", flag: "🇵🇱" },
  { name: "Qatar", code: "QA", currency: "QAR", flag: "🇶🇦" },
  { name: "Russia", code: "RU", currency: "RUB", flag: "🇷🇺" },
  { name: "Saudi Arabia", code: "SA", currency: "SAR", flag: "🇸🇦" },
  { name: "Singapore", code: "SG", currency: "SGD", flag: "🇸🇬" },
  { name: "South Africa", code: "ZA", currency: "ZAR", flag: "🇿🇦" },
  { name: "South Korea", code: "KR", currency: "KRW", flag: "🇰🇷" },
  { name: "Spain", code: "ES", currency: "EUR", flag: "🇪🇸" },
  { name: "Sweden", code: "SE", currency: "SEK", flag: "🇸🇪" },
  { name: "Switzerland", code: "CH", currency: "CHF", flag: "🇨🇭" },
  { name: "Thailand", code: "TH", currency: "THB", flag: "🇹🇭" },
  { name: "Turkey", code: "TR", currency: "TRY", flag: "🇹🇷" },
  { name: "United Arab Emirates", code: "AE", currency: "AED", flag: "🇦🇪" },
  { name: "United Kingdom", code: "GB", currency: "GBP", flag: "🇬🇧" },
  { name: "United States", code: "US", currency: "USD", flag: "🇺🇸" },
  { name: "Vietnam", code: "VN", currency: "VND", flag: "🇻🇳" },
];

const SYMBOLS: Record<string, string> = {
  AED: "AED", // rendered specially (image) by <Dh />
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", INR: "₹", KRW: "₩",
  SAR: "﷼", QAR: "﷼", OMR: "﷼", BHD: ".د.ب", KWD: "د.ك", JOD: "د.أ",
  EGP: "E£", MAD: "د.م.", PKR: "₨", BDT: "৳", IDR: "Rp", PHP: "₱",
  THB: "฿", VND: "₫", MYR: "RM", SGD: "S$", HKD: "HK$", AUD: "A$",
  NZD: "NZ$", CAD: "C$", CHF: "Fr", NOK: "kr", SEK: "kr", PLN: "zł",
  TRY: "₺", RUB: "₽", BRL: "R$", MXN: "Mex$", ARS: "AR$", ZAR: "R",
  NGN: "₦",
};

export function currencySymbol(code: string | null | undefined): string {
  if (!code) return "AED";
  return SYMBOLS[code] ?? code;
}

export function countryByCode(code: string): CountryEntry | undefined {
  return COUNTRIES.find((c) => c.code === code);
}
