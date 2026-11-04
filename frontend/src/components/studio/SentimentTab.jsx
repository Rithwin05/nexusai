import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Textarea } from "@/components/ui/textarea";
import { DocumentSelect } from "@/components/common/DocumentSelect";
import { ErrorState } from "@/components/common/Blocks";
import { InsightMeta, RunButton, Running, Section, useInsight } from "./useInsight";

const COLORS = { positive: "#34D399", negative: "#F43F5E", neutral: "#94A3B8" };
const Label = ({ l }) => <span className="nx-chip" style={{ color: COLORS[l], borderColor: `${COLORS[l]}55`, background: `${COLORS[l]}14` }}>{l || "n/a"}</span>;

export const SentimentTab = ({ documents }) => {
  const [source, setSource] = useState("doc");
  const [doc, setDoc] = useState("");
  const [text, setText] = useState("");
  const { insight, running, error, run } = useInsight("sentiment", source === "doc" ? doc : null, "/intelligence/sentiment");
  const r = insight?.result;
  const dist = r ? Object.entries(r.distribution).map(([k, v]) => ({ name: k, value: v })) : [];
  return (
    <div className="space-y-5">
      <div className="flex rounded-md border border-[#202C3D] bg-[#0E1420] p-0.5 w-fit">
        {[["doc", "Document"], ["text", "Custom text"]].map(([v, l]) => (
          <button key={v} onClick={() => setSource(v)} data-testid={`sentiment-source-${v}`}
            className={`rounded px-3 py-1.5 text-xs ${source === v ? "bg-[#111B2A] text-cyan-300" : "text-slate-400"}`}>{l}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-3">
        {source === "doc" ? <DocumentSelect documents={documents} value={doc} onChange={setDoc} testId="sentiment-document-select" /> : (
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text to analyse…" className="min-h-28 max-w-2xl border-[#202C3D] bg-[#0E1420]" data-testid="sentiment-text-input" />
        )}
        <RunButton running={running} hasResult={Boolean(r)} disabled={source === "doc" ? !doc : !text.trim()} label="Analyse sentiment" testId="sentiment-generate-button"
          onClick={() => run(source === "doc" ? { document_id: doc } : { text })} />
      </div>
      <InsightMeta insight={insight} />
      {error && <ErrorState message={error} />}
      {running && <Running text="Classifying sampled sentences and overall tone…" />}
      {r && !running && (
        <div className="space-y-4" data-testid="sentiment-result">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <Section title="Overall tone">
              <div className="flex items-center gap-3"><Label l={r.overall?.label} />
                <span className="font-mono text-xs text-slate-400">confidence {r.overall?.confidence != null ? Number(r.overall.confidence).toFixed(2) : "n/a"} (self-reported)</span></div>
              <p className="mt-3">{r.overall?.explanation}</p>
              <p className="mt-4 rounded border border-[#202C3D] bg-[#080B12] p-3 text-xs text-slate-500" data-testid="sentiment-method-note">{r.method} Sampled {r.sampled_sentences} sentences.</p>
            </Section>
            <Section title="Sentence distribution">
              <div className="h-48">
                <ResponsiveContainer>
                  <BarChart data={dist}><XAxis dataKey="name" stroke="#64748B" fontSize={11} /><YAxis allowDecimals={false} stroke="#64748B" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#0E1420", border: "1px solid #202C3D" }} cursor={{ fill: "#111B2A" }} />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>{dist.map((d) => <Cell key={d.name} fill={COLORS[d.name]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>
          <Section title="Sentence-level sentiment">
            <ul className="divide-y divide-[#202C3D]">
              {r.sentences.map((s, i) => (
                <li key={i} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start" data-testid={`sentiment-sentence-${i}`}>
                  <div className="w-24 shrink-0"><Label l={s.label} /></div>
                  <div className="flex-1"><p className="text-slate-300">{s.text}</p>{s.reason && <p className="mt-1 text-xs text-slate-500">{s.reason}</p>}</div>
                  <span className="font-mono text-[11px] text-slate-500">{s.confidence != null ? Number(s.confidence).toFixed(2) : ""}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}
    </div>
  );
};
