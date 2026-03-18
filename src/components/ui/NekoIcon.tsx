interface NekoIconProps {
  size?: number
}

export default function NekoIcon({ size = 24 }: NekoIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 耳 */}
      <path d="M5 9 L4 3 L9 7" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 9 L20 3 L15 7" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* 頭 */}
      <ellipse cx="12" cy="11" rx="6.5" ry="5.5" stroke="white" strokeWidth="1.6" />
      {/* 目 */}
      <ellipse cx="9.5" cy="10" rx="1.1" ry="1.3" fill="white" />
      <ellipse cx="14.5" cy="10" rx="1.1" ry="1.3" fill="white" />
      {/* 鼻 */}
      <path d="M11 13 L12 14 L13 13" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      {/* ひげ左 */}
      <line x1="5.5" y1="12.5" x2="9" y2="13" stroke="white" strokeWidth="1" strokeLinecap="round" />
      <line x1="5.5" y1="14" x2="9" y2="13.8" stroke="white" strokeWidth="1" strokeLinecap="round" />
      {/* ひげ右 */}
      <line x1="18.5" y1="12.5" x2="15" y2="13" stroke="white" strokeWidth="1" strokeLinecap="round" />
      <line x1="18.5" y1="14" x2="15" y2="13.8" stroke="white" strokeWidth="1" strokeLinecap="round" />
      {/* しっぽ */}
      <path d="M18 22 Q22 18 20 13" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      {/* 体 */}
      <path d="M7 16 Q6 20 7 22" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 16 Q12 18.5 17 16" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 16 Q18 20 17 22" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
