export default function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="ScholarIQ">
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A1517" />
          <stop offset="1" stopColor="#140A0B" />
        </linearGradient>
        <linearGradient id="lg-fire" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF4B2B" />
          <stop offset="1" stopColor="#FFB347" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" rx="52" fill="url(#lg-bg)" />
      <path d="M40 34 C44 96 70 144 100 166 C92 128 74 82 40 34 Z" fill="url(#lg-fire)" />
      <path d="M160 34 C156 96 130 144 100 166 C108 128 126 82 160 34 Z" fill="url(#lg-fire)" />
      <path d="M100 50 C113 70 113 88 100 102 C87 88 87 70 100 50 Z" fill="#FFD27A" />
    </svg>
  );
}
