// Display formatting only. The values themselves come unrounded from the R API.

const yenFmt = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });

/** Rate as a percentage, e.g. 0.0224 -> "2.2400%". */
export function pct(rate: number, digits = 4): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

/** Basis points with sign, e.g. 0.2357 -> "+0.2357 bp". */
export function bp(value: number, digits = 4): string {
  const s = value.toFixed(digits);
  return `${value > 0 && Number(s) !== 0 ? "+" : ""}${s} bp`;
}

/** Yen. Amounts below 0.5 yen are written in exponent form so that numerical noise stays visible. */
export function yen(value: number, signed = false): string {
  if (Math.abs(value) < 0.5) return `${value.toExponential(2)} 円`;
  const s = yenFmt.format(value);
  return `${signed && value > 0 ? "+" : ""}${s} 円`;
}

export function df(value: number, digits = 10): string {
  return value.toFixed(digits);
}

/** Full double, for "unrounded" values. */
export function full(value: number): string {
  return String(value);
}

export function tenorJa(tenor: string): string {
  const m = /^(\d+)([MY])$/.exec(tenor);
  if (!m) return tenor;
  return m[2] === "Y" ? `${m[1]}年` : `${m[1]}か月`;
}
