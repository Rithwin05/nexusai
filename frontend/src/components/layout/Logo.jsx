export const Logo = ({ compact = false }) => (
  <div className="flex items-center gap-2.5" data-testid="nexus-logo">
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="7" stroke="#202C3D" fill="#0E1420" />
      <path d="M9 23V9l14 14V9" stroke="#67E8F9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="2" fill="#A78BFA" />
      <circle cx="23" cy="23" r="2" fill="#A78BFA" />
    </svg>
    {!compact && (
      <div className="leading-none">
        <div className="font-display text-[15px] font-semibold tracking-wide text-slate-100">NEXUS<span className="text-cyan-300"> AI</span></div>
        <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500">Knowledge OS</div>
      </div>
    )}
  </div>
);
