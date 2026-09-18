export const dateFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const timeFormatter = new Intl.DateTimeFormat("ar-EG", {
  hour: "2-digit",
  minute: "2-digit",
});

// Prices are stored in minor currency units (cents/fen) — see
// database/schema/credit-packages.ts. Numerals are forced to the Latin
// (Western) digit set: money amounts read the same regardless of UI locale,
// and "٥٠" reads as unfamiliar/ambiguous to most teachers next to a $ or ¥ sign.
export function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat("ar-EG-u-nu-latn", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(price / 100);
}
