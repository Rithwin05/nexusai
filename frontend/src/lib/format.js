export const formatBytes = (b) => {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
};

export const formatMs = (ms) => {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

export const formatNum = (n) => (n == null ? "—" : new Intl.NumberFormat("en", { notation: n > 99999 ? "compact" : "standard" }).format(n));

export const timeAgo = (iso) => {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
};

export const pages = (a, b) => (a == null ? "page n/a" : a === b || b == null ? `p. ${a}` : `pp. ${a}–${b}`);

export const pct = (v) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
