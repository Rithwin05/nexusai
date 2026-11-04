import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Loader2, Search as SearchIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/Blocks";
import { CitationMeta } from "@/components/common/CitationSheet";
import { useWorkspace } from "@/components/layout/AppShell";
import { errMsg, useApi } from "@/lib/api";
import { formatMs } from "@/lib/format";

const MODES = [["semantic", "Semantic"], ["keyword", "Keyword"], ["hybrid", "Hybrid"]];

const Highlight = ({ text, query }) => {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  if (!words.length) return text;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return text.split(re).map((p, i) => (i % 2 ? <mark key={i} className="rounded bg-violet-500/20 px-0.5 text-violet-200">{p}</mark> : p));
};

export default function Search() {
  const api = useApi();
  const navigate = useNavigate();
  const { documents } = useWorkspace();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("hybrid");
  const [topK, setTopK] = useState("10");
  const [threshold, setThreshold] = useState(0.2);
  const [doc, setDoc] = useState("all");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(null); setRes(null);
    try {
      const r = await api.post("/search", { query, mode, top_k: Number(topK), threshold, document_ids: doc === "all" ? null : [doc] });
      setRes({ ...r.data, query });
    } catch (err) { setError(errMsg(err)); } finally { setLoading(false); }
  };

  return (
    <Page>
      <PageHeader eyebrow="Semantic Discovery" title="Search by meaning"
        description="Returns the actual matching passages — no generated text. Semantic uses cosine similarity over embeddings, keyword uses MongoDB full-text, hybrid fuses both with reciprocal-rank fusion." />
      <form onSubmit={run} className="space-y-4">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. methods used to reduce model training costs" data-testid="search-query-input"
            className="w-full rounded-lg border border-[#202C3D] bg-[#0E1420] py-4 pl-12 pr-28 text-base text-slate-100 placeholder:text-slate-600 focus:border-[#334155] focus:outline-none" />
          <button type="submit" disabled={loading || !query.trim()} data-testid="search-submit-button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-medium text-[#080B12] hover:bg-cyan-200 disabled:opacity-40">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex rounded-md border border-[#202C3D] bg-[#0E1420] p-0.5">
            {MODES.map(([v, l]) => (
              <button type="button" key={v} onClick={() => setMode(v)} data-testid={`search-mode-${v}-button`}
                className={`rounded px-3 py-1.5 text-xs transition-colors ${mode === v ? "bg-[#111B2A] text-cyan-300" : "text-slate-400 hover:text-slate-200"}`}>{l}</button>
            ))}
          </div>
          <Select value={topK} onValueChange={setTopK}>
            <SelectTrigger className="h-9 w-28 border-[#202C3D] bg-[#0E1420] text-xs" data-testid="search-topk-select"><SelectValue /></SelectTrigger>
            <SelectContent className="border-[#202C3D] bg-[#0E1420]">{["5", "10", "20"].map((k) => <SelectItem key={k} value={k}>Top {k}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={doc} onValueChange={setDoc}>
            <SelectTrigger className="h-9 w-56 border-[#202C3D] bg-[#0E1420] text-xs" data-testid="search-document-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="border-[#202C3D] bg-[#0E1420]">
              <SelectItem value="all">All documents</SelectItem>
              {documents.filter((d) => d.status === "indexed").map((d) => <SelectItem key={d.id} value={d.id}>{d.filename}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className={`flex items-center gap-3 ${mode === "keyword" ? "opacity-40" : ""}`}>
            <span className="text-xs text-slate-400">Min cosine sim</span>
            <Slider value={[threshold]} min={0} max={0.8} step={0.05} onValueChange={([v]) => setThreshold(v)} disabled={mode === "keyword"} className="w-32" data-testid="search-threshold-slider" />
            <span className="w-10 font-mono text-xs text-cyan-300">{threshold.toFixed(2)}</span>
          </div>
        </div>
      </form>
      {error && <ErrorState message={error} />}
      {res && (
        <div className="space-y-4" data-testid="search-results">
          <div className="font-mono text-xs text-slate-500" data-testid="search-results-summary">
            {res.results.length} passages · {res.mode} · searched {res.searched_chunks} chunks · {formatMs(res.retrieval_ms)}
            {res.best_similarity != null && ` · best cos sim ${res.best_similarity.toFixed(3)}`}
          </div>
          {res.results.length === 0 ? (
            <EmptyState icon={SearchIcon} title="No passages passed the threshold" description="Try different wording, a lower similarity threshold, or keyword mode." testId="search-no-results" />
          ) : res.results.map((r) => (
            <article key={r.chunk_id} className="nx-card nx-card-hover p-5" data-testid={`search-result-${r.rank}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-medium text-slate-100">{r.document_name}</div>
                  <div className="mt-2"><CitationMeta c={r} /></div>
                </div>
                <button onClick={() => navigate(`/app/knowledge/${r.document_id}?chunk=${r.chunk_id}`)} data-testid={`search-result-open-${r.rank}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#202C3D] px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-700/60 hover:text-cyan-300">
                  <ExternalLink className="h-3.5 w-3.5" />Open source
                </button>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-300"><Highlight text={r.text} query={res.query} /></p>
              <div className="mt-3 font-mono text-[10px] text-slate-600">matched by: {r.matched_by.join(" + ") || "—"}{res.mode === "hybrid" && ` · RRF ${r.fused_score}`}</div>
            </article>
          ))}
        </div>
      )}
      {!res && !error && <EmptyState icon={SearchIcon} title="Search your knowledge by meaning" description="Try a natural-language description of what you're looking for, rather than exact words." testId="search-initial-state" />}
    </Page>
  );
}
