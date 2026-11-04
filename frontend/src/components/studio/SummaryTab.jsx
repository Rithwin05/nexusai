import { useState } from "react";
import { DocumentSelect } from "@/components/common/DocumentSelect";
import { Evidence, useCitation } from "@/components/common/Evidence";
import { Markdown } from "@/components/common/Markdown";
import { ErrorState } from "@/components/common/Blocks";
import { InsightMeta, RunButton, Running, Section, useInsight } from "./useInsight";

export const SummaryTab = ({ documents }) => {
  const [doc, setDoc] = useState("");
  const { insight, running, error, run } = useInsight("summary", doc, "/intelligence/summary");
  const cite = useCitation();
  const r = insight?.result;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <DocumentSelect documents={documents} value={doc} onChange={setDoc} testId="summary-document-select" />
        <RunButton running={running} hasResult={Boolean(r)} disabled={!doc} onClick={() => run({ document_id: doc })} label="Summarise" testId="summary-generate-button" />
        <InsightMeta insight={insight} />
      </div>
      {error && <ErrorState message={error} />}
      {running && <Running />}
      {r && !running && (
        <div className="grid gap-4 lg:grid-cols-2" data-testid="summary-result">
          <div className="lg:col-span-2"><Section title="Executive summary"><p className="text-base text-slate-200">{r.executive_summary}</p></Section></div>
          <div className="lg:col-span-2"><Section title="Detailed summary"><Markdown content={r.detailed_summary} /></Section></div>
          <Section title="Key concepts">
            <ul className="space-y-3">{(r.key_concepts || []).map((k, i) => (
              <li key={i}><span className="font-medium text-slate-100">{k.name}</span> — {k.description} <Evidence items={k.evidence} onOpen={cite.open} /></li>))}</ul>
          </Section>
          <Section title="Main findings">
            <ul className="space-y-3">{(r.main_findings || []).map((f, i) => (<li key={i}>{f.finding} <Evidence items={f.evidence} onOpen={cite.open} /></li>))}</ul>
          </Section>
          <Section title="Terminology" accent="violet">
            <dl className="space-y-2">{(r.terminology || []).map((t, i) => (
              <div key={i}><dt className="font-mono text-xs text-violet-300">{t.term}</dt><dd className="text-slate-400">{t.definition}</dd></div>))}</dl>
          </Section>
          <div className="space-y-4">
            <Section title="Conclusions"><ul className="list-disc space-y-1.5 pl-5">{(r.conclusions || []).map((c, i) => <li key={i}>{c}</li>)}</ul></Section>
            <Section title="Future scope" accent="violet"><ul className="list-disc space-y-1.5 pl-5">{(r.future_scope || []).map((c, i) => <li key={i}>{c}</li>)}</ul></Section>
          </div>
        </div>
      )}
      {cite.sheet}
    </div>
  );
};
