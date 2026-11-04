import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/Blocks";
import { StatusPill } from "@/components/common/StatusPill";
import { useApi, useFetch } from "@/lib/api";
import { formatBytes, formatMs, pages } from "@/lib/format";

export default function DocumentDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const focus = params.get("chunk");
  const doc = useFetch(`/documents/${id}`, { interval: 0 });
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(200);
  const chunks = useFetch(`/documents/${id}/chunks?limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ""}`);
  const [tab, setTab] = useState("chunks");
  const focused = chunks.data?.chunks.find((c) => c.id === focus);

  useEffect(() => {
    if (!focus || !chunks.data) return;
    const el = document.getElementById(`chunk-${focus}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus, chunks.data]);

  if (doc.error) return <Page><ErrorState message={doc.error} /></Page>;
  if (!doc.data) return <Page><Skeleton className="h-40 bg-[#0E1420]" /></Page>;
  const d = doc.data;

  return (
    <Page>
      <Link to="/app/knowledge" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200" data-testid="back-to-knowledge-link"><ArrowLeft className="h-3.5 w-3.5" />Knowledge Base</Link>
      <PageHeader eyebrow="Document" title={d.filename} description={d.metadata?.title && d.metadata.title !== d.filename ? d.metadata.title : undefined}
        actions={<StatusPill status={d.status} stage={d.stage} progress={d.progress} testId="document-detail-status" />} />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[#202C3D] bg-[#202C3D] sm:grid-cols-3 lg:grid-cols-6" data-testid="document-meta">
        {[["Pages", d.page_count ?? "—"], ["Chunks", d.chunk_count || "—"], ["Characters", d.char_count?.toLocaleString() ?? "—"], ["Size", formatBytes(d.size)],
          ["Processing", formatMs(d.processing_ms)], ["Embedding", d.embedding_model || "—"]].map(([k, v]) => (
          <div key={k} className="bg-[#0E1420] px-4 py-3"><div className="nx-label">{k}</div><div className="mt-1 truncate font-mono text-sm text-slate-200">{v}</div></div>
        ))}
      </div>
      {d.error && <ErrorState message={d.error} />}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="border border-[#202C3D] bg-[#0E1420]">
          <TabsTrigger value="chunks" data-testid="tab-chunks">Chunk inspector</TabsTrigger>
          <TabsTrigger value="pdf" data-testid="tab-pdf">Original PDF</TabsTrigger>
          <TabsTrigger value="meta" data-testid="tab-metadata">Metadata</TabsTrigger>
        </TabsList>
        <TabsContent value="chunks" className="mt-5 space-y-4">
          <div className="relative max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find text within chunks…" className="border-[#202C3D] bg-[#0E1420] pl-9" data-testid="chunk-search-input" />
          </div>
          {chunks.loading ? <Skeleton className="h-64 bg-[#0E1420]" /> : (
            <>
              <div className="font-mono text-xs text-slate-500">{chunks.data?.total ?? 0} chunks{q && " matching"}</div>
              <div className="space-y-3" data-testid="chunk-list">
                {chunks.data?.chunks.map((c) => (
                  <article key={c.id} id={`chunk-${c.id}`} data-testid={`chunk-${c.ordinal}`}
                    className={`rounded-lg border border-[#202C3D] bg-[#0E1420] p-4 ${c.id === focus ? "nx-highlight" : ""}`}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="nx-chip border-[#202C3D] text-slate-400">#{c.ordinal}</span>
                      <span className="nx-chip border-[#202C3D] text-slate-400">{pages(c.page_start, c.page_end)}</span>
                      <span className="nx-chip border-[#202C3D] text-slate-500">{c.text.length} chars</span>
                      {c.id === focus && <span className="nx-chip border-cyan-700/50 bg-cyan-950/60 text-cyan-300">cited passage</span>}
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{c.text}</p>
                  </article>
                ))}
              </div>
              {chunks.data && chunks.data.total > limit && (
                <button onClick={() => setLimit((l) => l + 200)} className="rounded-md border border-[#202C3D] px-4 py-2 text-sm text-slate-300 hover:border-[#334155]" data-testid="load-more-chunks-button">Load more</button>
              )}
            </>
          )}
        </TabsContent>
        <TabsContent value="pdf" className="mt-5"><PdfViewer id={id} page={focused?.page_start} active={tab === "pdf"} /></TabsContent>
        <TabsContent value="meta" className="mt-5">
          <pre className="overflow-x-auto rounded-lg border border-[#202C3D] bg-[#060910] p-4 font-mono text-xs text-slate-300" data-testid="document-metadata-json">
            {JSON.stringify({ id: d.id, filename: d.filename, sha256: d.sha256, status: d.status, metadata: d.metadata, created_at: d.created_at, indexed_at: d.indexed_at }, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </Page>
  );
}

const PdfViewer = ({ id, page, active }) => {
  const api = useApi();
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!active || url) return undefined;
    let u;
    api.blob(`/documents/${id}/file`).then((b) => { u = URL.createObjectURL(b); setUrl(u); }).catch(() => setErr("Could not load the original PDF."));
    return undefined;
  }, [active, api, id, url]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  if (err) return <ErrorState message={err} />;
  if (!url) return <Skeleton className="h-[70vh] bg-[#0E1420]" />;
  return <iframe title="PDF" src={`${url}${page ? `#page=${page}` : ""}`} className="h-[75vh] w-full rounded-lg border border-[#202C3D] bg-white" data-testid="pdf-viewer" />;
};
