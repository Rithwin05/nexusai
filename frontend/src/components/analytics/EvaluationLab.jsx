import { useState } from "react";
import { FlaskConical, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/common/Blocks";
import { DocumentSelect } from "@/components/common/DocumentSelect";
import { RunButton } from "@/components/studio/useInsight";
import { useWorkspace } from "@/components/layout/AppShell";
import { errMsg, useApi, useFetch } from "@/lib/api";
import { formatMs, pct, timeAgo } from "@/lib/format";

export const EvaluationLab = () => {
  const api = useApi();
  const { documents, workspace } = useWorkspace();
  const items = useFetch("/evaluation/items");
  const runs = useFetch("/evaluation/runs");
  const [cfg, setCfg] = useState({ mode: workspace?.settings?.mode || "hybrid", top_k: "5", threshold: "0" });
  const [busy, setBusy] = useState(null);
  const [manual, setManual] = useState({ question: "", document_id: "", keywords: "" });

  const act = async (name, fn) => { setBusy(name); try { await fn(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); } };
  const generate = () => act("gen", async () => { const r = await api.post("/evaluation/generate", { count: 8 }); toast.success(`${r.data.length} benchmark questions generated`); items.reload(); });
  const run = () => act("run", async () => { await api.post("/evaluation/run", { mode: cfg.mode, top_k: Number(cfg.top_k), threshold: Number(cfg.threshold) }); toast.success("Evaluation run complete"); runs.reload(); });
  const add = () => act("add", async () => {
    await api.post("/evaluation/items", { question: manual.question, document_id: manual.document_id, expected_keywords: manual.keywords.split(",").map((k) => k.trim()).filter(Boolean) });
    setManual({ question: "", document_id: "", keywords: "" }); items.reload();
  });
  const remove = (id) => act("del", async () => { await api.delete(`/evaluation/items/${id}`); items.reload(); });
  const history = runs.data?.runs || [];
  const chart = [...history].reverse().slice(-8).map((r, i) => ({ name: `#${i + 1} ${r.config.mode} k${r.config.top_k}`, recall: r.metrics.recall_at_k, precision: r.metrics.precision_at_k, mrr: r.metrics.mrr }));

  return (
    <section className="space-y-6" data-testid="evaluation-lab">
      <div className="flex items-center gap-2 border-t border-[#202C3D] pt-8"><FlaskConical className="h-5 w-5 text-violet-300" /><h2 className="font-display text-xl font-semibold text-slate-100">RAG Evaluation Lab</h2></div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Panel title={`Benchmark set · ${items.data?.length || 0} questions`} testId="eval-items-panel"
          actions={<RunButton running={busy === "gen"} hasResult={false} onClick={generate} label="Generate 8 from documents" testId="eval-generate-button" />}>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input value={manual.question} onChange={(e) => setManual({ ...manual, question: e.target.value })} placeholder="Manual question…" className="border-[#202C3D] bg-[#080B12]" data-testid="eval-manual-question-input" />
            <DocumentSelect documents={documents} value={manual.document_id} onChange={(v) => setManual({ ...manual, document_id: v })} placeholder="Expected document" testId="eval-manual-document-select" />
            <Input value={manual.keywords} onChange={(e) => setManual({ ...manual, keywords: e.target.value })} placeholder="Expected keywords (comma separated, optional)" className="border-[#202C3D] bg-[#080B12]" data-testid="eval-manual-keywords-input" />
            <button onClick={add} disabled={!manual.question.trim() || manual.question.trim().length < 5 || !manual.document_id || busy === "add"} data-testid="eval-add-item-button"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#202C3D] px-3 py-2 text-sm text-slate-300 hover:border-[#334155] disabled:opacity-40"><Plus className="h-4 w-4" />Add</button>
          </div>
          <ul className="max-h-72 divide-y divide-[#202C3D] overflow-y-auto" data-testid="eval-items-list">
            {(items.data || []).length === 0 && <li className="py-3 text-sm text-slate-500">No benchmark questions yet. Generate them from your indexed passages or add your own.</li>}
            {(items.data || []).map((it) => (
              <li key={it.id} className="flex items-start gap-3 py-2.5 text-sm">
                <span className={`nx-chip mt-0.5 ${it.kind === "synthetic" ? "border-cyan-700/50 text-cyan-300" : "border-violet-500/30 text-violet-300"}`}>{it.kind}</span>
                <div className="min-w-0 flex-1"><div className="text-slate-300">{it.question}</div><div className="truncate font-mono text-[10px] text-slate-600">{it.document_name}{it.source_page && ` · p.${it.source_page}`}{it.expected_keywords?.length > 0 && ` · kw: ${it.expected_keywords.join(", ")}`}</div></div>
                <button onClick={() => remove(it.id)} aria-label="Remove question" className="rounded p-1 text-slate-600 hover:text-rose-300" data-testid={`eval-item-delete-${it.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Run configuration" testId="eval-run-panel">
          <div className="grid grid-cols-3 gap-3">
            {[["mode", ["semantic", "keyword", "hybrid"]], ["top_k", ["3", "5", "10"]], ["threshold", ["0", "0.2", "0.3", "0.4"]]].map(([k, opts]) => (
              <div key={k}><div className="nx-label mb-1.5">{k.replace("_", "-")}</div>
                <Select value={cfg[k]} onValueChange={(v) => setCfg({ ...cfg, [k]: v })}>
                  <SelectTrigger className="border-[#202C3D] bg-[#080B12] text-xs" data-testid={`eval-config-${k}`}><SelectValue /></SelectTrigger>
                  <SelectContent className="border-[#202C3D] bg-[#0E1420]">{opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select></div>
            ))}
          </div>
          <div className="mt-4"><RunButton running={busy === "run"} hasResult={false} disabled={!items.data?.length} onClick={run} label="Run benchmark" testId="evaluation-run-benchmark-button" /></div>
          {runs.data && (
            <div className="mt-5 space-y-2 rounded-md border border-[#202C3D] bg-[#080B12] p-3 text-xs text-slate-400" data-testid="eval-metric-notes">
              <div className="flex items-center gap-1.5 text-slate-300"><Info className="h-3.5 w-3.5" />How metrics are defined</div>
              {Object.entries(runs.data.metric_notes).map(([k, v]) => <p key={k}><span className="font-mono text-cyan-300">{k}</span> — {v}</p>)}
              <p className="text-amber-200/80">{runs.data.limitations}</p>
            </div>
          )}
        </Panel>
      </div>
      {history.length > 0 && (
        <>
          <Panel title="Configuration comparison" testId="eval-comparison-chart">
            <div className="h-64"><ResponsiveContainer>
              <BarChart data={chart}><CartesianGrid stroke="#202C3D" strokeDasharray="3 3" /><XAxis dataKey="name" stroke="#64748B" fontSize={10} /><YAxis domain={[0, 1]} stroke="#64748B" fontSize={11} />
                <Tooltip contentStyle={{ background: "#0E1420", border: "1px solid #202C3D", fontSize: 12 }} cursor={{ fill: "#111B2A" }} /><Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="recall" name="Recall@K" fill="#67E8F9" /><Bar dataKey="precision" name="Precision@K" fill="#A78BFA" /><Bar dataKey="mrr" name="MRR" fill="#34D399" />
              </BarChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="Evaluation history" testId="eval-history-table">
            <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
              <thead><tr className="nx-label text-left">{["Run", "Questions", "Recall@K", "Precision@K", "MRR", "Coverage", "Avg latency", "When"].map((h) => <th key={h} className="py-2 pr-4 font-normal">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-[#202C3D] font-mono text-xs text-slate-300">{history.map((r) => (
                <tr key={r.id} data-testid={`eval-run-${r.id}`}><td className="py-2.5 pr-4 text-cyan-300">{r.label}</td><td className="pr-4">{r.questions}</td><td className="pr-4">{pct(r.metrics.recall_at_k)}</td><td className="pr-4">{pct(r.metrics.precision_at_k)}</td>
                  <td className="pr-4">{r.metrics.mrr.toFixed(3)}</td><td className="pr-4">{pct(r.metrics.context_coverage)}</td><td className="pr-4">{formatMs(r.metrics.avg_latency_ms)}</td><td className="text-slate-500">{timeAgo(r.created_at)}</td></tr>
              ))}</tbody></table></div>
          </Panel>
        </>
      )}
    </section>
  );
};
