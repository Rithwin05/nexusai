import { useState } from "react";
import { DocumentSelect } from "@/components/common/DocumentSelect";
import { Evidence, useCitation } from "@/components/common/Evidence";
import { ErrorState } from "@/components/common/Blocks";
import { InsightMeta, RunButton, Running, Section, useInsight } from "./useInsight";

export const CompareTab = ({ documents }) => {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const { insight, running, error, run } = useInsight("compare", a && b ? `${a}:${b}` : null, "/intelligence/compare");
  const cite = useCitation();
  const r = insight?.result;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <DocumentSelect documents={documents} value={a} onChange={setA} placeholder="Document A" testId="compare-document-a-select" exclude={b} />
        <span className="font-mono text-xs text-slate-500">vs</span>
        <DocumentSelect documents={documents} value={b} onChange={setB} placeholder="Document B" testId="compare-document-b-select" exclude={a} />
        <RunButton running={running} hasResult={Boolean(r)} disabled={!a || !b} onClick={() => run({ document_a: a, document_b: b })} label="Compare" testId="compare-generate-button" />
      </div>
      <InsightMeta insight={insight} />
      {error && <ErrorState message={error} />}
      {running && <Running text="Comparing both documents passage by passage…" />}
      {r && !running && (
        <div className="space-y-4" data-testid="compare-result">
          <Section title="Overview"><p>{r.overview}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="nx-chip border-cyan-700/50 text-cyan-300">A · {r.documents?.a?.name}</span><span className="nx-chip border-violet-500/30 text-violet-300">B · {r.documents?.b?.name}</span></div>
          </Section>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Common themes">
              <ul className="space-y-3">{(r.common_themes || []).map((t, i) => <li key={i}><span className="font-medium text-slate-100">{t.theme}</span> — {t.detail} <Evidence items={t.evidence} onOpen={cite.open} /></li>)}</ul>
            </Section>
            <Section title="Methodology comparison" accent="violet">
              <p><span className="font-mono text-xs text-cyan-300">A</span> {r.methodology_comparison?.document_a}</p>
              <p className="mt-2"><span className="font-mono text-xs text-violet-300">B</span> {r.methodology_comparison?.document_b}</p>
              <p className="mt-3 text-slate-400">{r.methodology_comparison?.assessment}</p>
            </Section>
          </div>
          <Section title="Differences">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead><tr className="nx-label text-left"><th className="py-2 pr-4 font-normal">Aspect</th><th className="py-2 pr-4 font-normal">Document A</th><th className="py-2 pr-4 font-normal">Document B</th><th className="py-2 font-normal">Evidence</th></tr></thead>
                <tbody className="divide-y divide-[#202C3D]">{(r.differences || []).map((d, i) => (
                  <tr key={i}><td className="py-3 pr-4 align-top font-medium text-slate-200">{d.aspect}</td><td className="py-3 pr-4 align-top">{d.document_a}</td><td className="py-3 pr-4 align-top">{d.document_b}</td><td className="py-3 align-top"><Evidence items={d.evidence} onOpen={cite.open} /></td></tr>
                ))}</tbody>
              </table>
            </div>
          </Section>
          <Section title="Conflicting statements" accent="violet">
            {(r.conflicts || []).length === 0 ? <p className="text-slate-500">No direct conflicts identified in the analysed passages.</p> : (
              <ul className="space-y-4">{r.conflicts.map((c, i) => (
                <li key={i} className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                  <p><span className="font-mono text-xs text-cyan-300">A</span> {c.statement_a}</p><p className="mt-1"><span className="font-mono text-xs text-violet-300">B</span> {c.statement_b}</p>
                  <p className="mt-2 text-xs text-slate-400">{c.explanation}</p><div className="mt-2"><Evidence items={c.evidence} onOpen={cite.open} /></div>
                </li>))}</ul>
            )}
          </Section>
        </div>
      )}
      {cite.sheet}
    </div>
  );
};
