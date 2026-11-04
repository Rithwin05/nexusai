import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, MessageSquareText, Target } from "lucide-react";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { DocumentSelect } from "@/components/common/DocumentSelect";
import { Evidence, useCitation } from "@/components/common/Evidence";
import { EmptyState, ErrorState } from "@/components/common/Blocks";
import { useWorkspace } from "@/components/layout/AppShell";
import { InsightMeta, RunButton, Running, Section, useInsight } from "@/components/studio/useInsight";

const PRIORITY = { high: "border-rose-500/30 bg-rose-500/10 text-rose-300", medium: "border-amber-500/30 bg-amber-500/10 text-amber-300", low: "border-slate-500/30 bg-slate-500/10 text-slate-300" };

const List = ({ items, cite }) => (
  <ul className="space-y-2.5">{(items || []).map((x, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300" /><span>{typeof x === "string" ? x : x.text} {x.evidence && <Evidence items={x.evidence} onOpen={cite.open} />}</span></li>)}</ul>
);

export default function Research() {
  const { documents } = useWorkspace();
  const navigate = useNavigate();
  const [doc, setDoc] = useState("");
  const { insight, running, error, run } = useInsight("research", doc, "/research/analyze");
  const cite = useCitation();
  const r = insight?.result;

  return (
    <Page>
      <PageHeader eyebrow="Research Intelligence Mode" title="Research Gap Finder"
        description="Turn a paper into structured research insight — objectives, methodology, findings, limitations and future scope — then surface evidence-backed research gaps and questions for further study." />
      <div className="flex flex-wrap items-center gap-3">
        <DocumentSelect documents={documents} value={doc} onChange={setDoc} placeholder="Select a research document" testId="research-document-select" />
        <RunButton running={running} hasResult={Boolean(r)} disabled={!doc} onClick={() => run({ document_id: doc })} label="Analyse research" testId="research-generate-button" />
        <InsightMeta insight={insight} />
      </div>
      {error && <ErrorState message={error} />}
      {running && <Running text="Reviewing the paper like a senior research reviewer — extracting structure and identifying gaps. This can take up to a minute." />}
      {!doc && !running && <EmptyState icon={GraduationCap} title="Choose a document to analyse" description="Works best with academic papers, theses and technical reports." testId="research-empty-state" />}
      {r && !running && (
        <div className="space-y-6" data-testid="research-result">
          <div className="nx-card p-6">
            <div className="nx-label text-violet-300/90">{r.research_domain}</div>
            <h2 className="mt-2 font-display text-xl font-semibold text-slate-50">{r.title}</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Objectives"><List items={r.objectives} cite={cite} /></Section>
            <Section title="Research questions" accent="violet"><List items={r.research_questions} cite={cite} /></Section>
            <Section title="Methodology">
              <p>{r.methodology?.approach} <Evidence items={r.methodology?.evidence} onOpen={cite.open} /></p>
              <dl className="mt-3 grid gap-2 text-xs">
                <div><dt className="nx-label">Data</dt><dd className="mt-1 text-sm text-slate-300">{r.methodology?.data}</dd></div>
                <div><dt className="nx-label">Evaluation</dt><dd className="mt-1 text-sm text-slate-300">{r.methodology?.evaluation}</dd></div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">{(r.methodology?.techniques || []).map((t) => <span key={t} className="nx-chip border-[#202C3D] text-slate-300">{t}</span>)}</div>
            </Section>
            <Section title="Key findings"><List items={r.key_findings} cite={cite} /></Section>
            <Section title="Limitations" accent="violet">
              <ul className="space-y-2.5">{(r.limitations || []).map((l, i) => (
                <li key={i}>{l.text} <span className="nx-chip ml-1 border-[#202C3D] text-slate-500">{l.stated_by_authors ? "stated by authors" : "inferred"}</span> <Evidence items={l.evidence} onOpen={cite.open} /></li>))}</ul>
            </Section>
            <Section title="Future scope"><List items={r.future_scope} cite={cite} /></Section>
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2"><Target className="h-4 w-4 text-violet-300" /><h3 className="font-display text-lg font-semibold text-slate-100">Research gap matrix</h3></div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="research-gap-matrix">
              {(r.research_gaps || []).map((g, i) => (
                <article key={i} className="nx-card nx-card-hover flex flex-col p-5" data-testid={`research-gap-${i}`}>
                  <div className="flex items-center gap-2">
                    <span className="nx-chip border-violet-500/30 bg-violet-500/10 text-violet-300">{g.type}</span>
                    <span className={`nx-chip ${PRIORITY[g.priority] || PRIORITY.low}`}>{g.priority} priority</span>
                  </div>
                  <h4 className="mt-3 font-display text-[15px] font-medium leading-snug text-slate-100">{g.gap}</h4>
                  <p className="mt-2 text-sm text-slate-400">{g.rationale}</p>
                  <p className="mt-3 rounded border border-[#202C3D] bg-[#080B12] p-3 text-xs text-slate-300"><span className="nx-label mr-1 text-cyan-300/80">Opportunity</span>{g.opportunity}</p>
                  <div className="mt-auto pt-3"><Evidence items={g.evidence} onOpen={cite.open} /></div>
                </article>
              ))}
            </div>
          </div>

          <Section title="Questions for further research" accent="violet">
            <ul className="divide-y divide-[#202C3D]">{(r.follow_up_questions || []).map((q, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span className="font-mono text-xs text-slate-600">Q{i + 1}</span><span className="flex-1">{q}</span>
                <button onClick={() => navigate(`/app/chat?q=${encodeURIComponent(q)}`)} data-testid={`research-ask-question-${i}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded border border-[#202C3D] px-2.5 py-1 text-xs text-slate-400 hover:border-cyan-700/60 hover:text-cyan-300">
                  <MessageSquareText className="h-3.5 w-3.5" />Ask in chat
                </button>
              </li>))}</ul>
          </Section>
        </div>
      )}
      {cite.sheet}
    </Page>
  );
}
