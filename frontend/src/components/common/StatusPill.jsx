import { Loader2 } from "lucide-react";

const STYLES = {
  indexed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  processing: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  queued: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

export const StatusPill = ({ status, stage, progress, testId }) => (
  <span className={`nx-chip ${STYLES[status] || STYLES.queued}`} data-testid={testId}>
    {(status === "processing" || status === "queued") && <Loader2 className="h-3 w-3 animate-spin" />}
    {status === "processing" ? `${stage || "processing"} ${progress ?? 0}%` : status}
  </span>
);
