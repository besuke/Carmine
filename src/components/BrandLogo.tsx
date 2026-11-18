// 上の帯のロゴ：紅葉した葉を 1 枚（Infrago Quantlet の新緑の葉と同じ形、色だけ秋）
export function BrandLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style={{ verticalAlign: "-0.28em", marginRight: "0.4rem" }}>
      <defs><linearGradient id="leafA" x1="5" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#b3123b"/><stop offset="1" stopColor="#f59e0b"/></linearGradient></defs><path d="M4.5 19.5C3.5 10.5 9.5 4 20 4C20.5 14.5 14 20.5 4.5 19.5Z" fill="url(#leafA)" stroke="#7f1030" strokeWidth="1.2" strokeLinejoin="round"/><path d="M4.5 19.5L2.6 21.7" stroke="#7f1030" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
      <path d="M4.5 19.5C8.5 14.5 12.5 10.5 17 7M8 15.5L8.6 11.2M8 15.5L12.6 16M11.6 12L12.2 8M11.6 12L16.3 12.7" stroke="#fff7ed" strokeWidth="1" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
