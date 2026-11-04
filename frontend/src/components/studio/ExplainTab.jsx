import { useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/common/Markdown";
import { useCitation } from "@/components/common/Evidence";
import { ErrorState } from "@/components/common/Blocks";
import { InsightMeta, RunButton, Running, useInsight } from "./useInsight";

export const ExplainTab = () => {
  const [concept, setConcept] = useState("");
  const [level, setLevel] = useState("beginner");
  const { insight, running, error, run } = useInsight("explain", null, "/intelligence/explain");
  const cite = useCitation();
  const r = insight?.result;
  const openTag = (tag) => { const c = r?.citations?.find((x) => x.tag === tag); if (c) cite.open(c); };
  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); if (concept.trim()) run({ concept, level }); }} className="flex flex-wrap items-center gap-3">
        <Input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Concept to explain, e.g. attention mechanism" className="max-w-md border-[#202C3D] bg-[#0E1420]" data-testid="explain-concept-input" />
        <div className="flex rounded-md border border-[#202C3D] bg-[#0E1420] p-0.5">
          {["beginner", "intermediate", "expert"].map((l) => (
            <button type="button" key={l} onClick={() => setLevel(l)} data-testid={`explain-level-${l}`}
              className={`rounded px-3 py-1.5 text-xs capitalize ${level === l ? "bg-[#111B2A] text-cyan-300" : "text-slate-400"}`}>{l}</button>
          ))}
        </div>
        <RunButton running={running} hasResult={false} disabled={!concept.trim()} onClick={() => run({ concept, level })} label="Explain" testId="explain-generate-button" />
      </form>
      <InsightMeta insight={insight} />
      {error && <ErrorState message={error} />}
      {running && <Running text="Retrieving relevant passages and writing structured learning notes…" />}
      {r && !running && (
        <div className="nx-card p-6" data-testid="explain-result">
          <div className={`mb-4 inline-flex items-center gap-2 rounded border px-2.5 py-1 text-xs ${r.grounded ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-amber-500/30 bg-amber-500/5 text-amber-200"}`} data-testid="explain-grounding-badge">
            {r.grounded ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
            {r.grounded ? `Grounded in ${r.citations.length} retrieved passages` : "General AI-assisted explanation — not from your documents"}
          </div>
          <Markdown content={r.markdown} onCite={openTag} />
        </div>
      )}
      {cite.sheet}
    </div>
  );
};
