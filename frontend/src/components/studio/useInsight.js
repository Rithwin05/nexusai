import { useCallback, useEffect, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { errMsg, useApi } from "@/lib/api";
import { formatMs, timeAgo } from "@/lib/format";

export function useInsight(kind, key, endpoint) {
  const api = useApi();
  const [insight, setInsight] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setInsight(null); setError(null);
    if (!key) return;
    api.get(`/insights?kind=${kind}&key=${encodeURIComponent(key)}`).then((r) => setInsight(r.data)).catch(() => {});
  }, [api, kind, key]);

  const run = useCallback(async (body) => {
    setRunning(true); setError(null);
    try { const r = await api.post(endpoint, body); setInsight(r.data); }
    catch (e) { setError(errMsg(e)); toast.error(errMsg(e)); }
    finally { setRunning(false); }
  }, [api, endpoint]);

  return { insight, running, error, run, setInsight };
}

export const RunButton = ({ running, hasResult, onClick, disabled, label = "Generate", testId }) => (
  <button onClick={onClick} disabled={running || disabled} data-testid={testId}
    className="nx-btn-glow inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40">
    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
    {running ? "Analysing…" : hasResult ? "Regenerate" : label}
  </button>
);

export const InsightMeta = ({ insight }) => insight && (
  <div className="font-mono text-[11px] text-slate-500" data-testid="insight-meta">
    generated {timeAgo(insight.created_at)} · {formatMs(insight.latency_ms)} · {(insight.tokens?.input_tokens || 0) + (insight.tokens?.output_tokens || 0)} tokens
    {insight.result?.coverage && ` · ${insight.result.coverage.chunks_used}/${insight.result.coverage.chunks_total} chunks analysed`}
  </div>
);

export const Running = ({ text = "Reading the document and producing a structured analysis. This usually takes 20–60 seconds." }) => (
  <div className="flex items-center gap-3 rounded-lg border border-[#202C3D] bg-[#0E1420] p-5 text-sm text-slate-400" data-testid="insight-running">
    <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />{text}
  </div>
);

export const Section = ({ title, children, accent = "cyan" }) => (
  <section className="nx-card p-5">
    <h3 className={`nx-label mb-3 ${accent === "violet" ? "text-violet-300/90" : "text-cyan-300/90"}`}>{title}</h3>
    <div className="text-sm leading-relaxed text-slate-300">{children}</div>
  </section>
);
