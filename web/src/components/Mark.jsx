/** GhanaCropGuard mark: a leaf held inside a camera viewfinder's corners. */
export function Mark({ size = 28, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <path
        d="M3 10V3h7M22 3h7v7M29 22v7h-7M10 29H3v-7"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
      <path d="M9.5 22.5C9 14 14.5 9 23 9c.4 8.6-4.8 14-13.5 13.5Z" fill="var(--accent)" />
      <path d="M10.5 21.5 18.5 13.5" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark />
      <span className="whitespace-nowrap text-[16px] font-medium tracking-[-0.01em] text-ink">
        GhanaCropGuard <span className="text-muted font-normal">AI</span>
      </span>
    </span>
  );
}
