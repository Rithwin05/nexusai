import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Database, Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState } from "@/components/common/Blocks";
import { UploadDropzone } from "@/components/knowledge/UploadDropzone";
import { DocumentTable } from "@/components/knowledge/DocumentTable";
import { useWorkspace } from "@/components/layout/AppShell";
import { errMsg, useApi, useFetch } from "@/lib/api";

export default function KnowledgeBase() {
  const api = useApi();
  const [params] = useSearchParams();
  const { workspace, reloadDocuments } = useWorkspace();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const docs = useFetch("/documents", { interval: busy ? 2500 : 0 });
  const list = docs.data || [];
  const anyBusy = list.some((d) => d.status === "processing" || d.status === "queued");
  useEffect(() => { setBusy(anyBusy); if (!anyBusy) reloadDocuments(); }, [anyBusy]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => { docs.reload(); reloadDocuments(); };
  const onDelete = async (d) => {
    try { const r = await api.delete(`/documents/${d.id}`); toast.success(`Deleted ${d.filename} · ${r.data.chunks_removed} chunks removed`); refresh(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const onReindex = async (d) => {
    try { await api.post(`/documents/${d.id}/reindex`); toast.success(`Re-indexing ${d.filename}`); refresh(); }
    catch (e) { toast.error(errMsg(e)); }
  };

  const filtered = list.filter((d) => (status === "all" || d.status === status) && d.filename.toLowerCase().includes(q.toLowerCase()));
  const totals = { chunks: list.reduce((s, d) => s + (d.chunk_count || 0), 0), indexed: list.filter((d) => d.status === "indexed").length };

  return (
    <Page>
      <PageHeader eyebrow="Knowledge Base" title="Documents"
        description="Upload PDFs to extract page-aware text, split it into overlapping chunks and index 1,536-dimension embeddings. Processing runs in the background."
        actions={<span className="font-mono text-xs text-slate-500" data-testid="kb-totals">{list.length} docs · {totals.indexed} indexed · {totals.chunks} chunks</span>} />
      <UploadDropzone maxMb={workspace?.system?.max_upload_mb || 20} onUploaded={refresh} autoOpen={params.get("upload") === "1"} />
      {workspace?.system && !workspace.system.embeddings_configured && (
        <ErrorState message="Embeddings are not configured (OPENAI_API_KEY missing on the server). Uploads will be stored but indexing will fail until a key is added." />
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents by name…" className="border-[#202C3D] bg-[#0E1420] pl-9" data-testid="document-search-input" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full border-[#202C3D] bg-[#0E1420] sm:w-48" data-testid="document-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent className="border-[#202C3D] bg-[#0E1420]">
            {["all", "indexed", "processing", "queued", "failed"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {docs.error && <ErrorState message={docs.error} onRetry={docs.reload} />}
      {docs.loading ? <Skeleton className="h-48 bg-[#0E1420]" /> : list.length === 0 ? (
        <EmptyState icon={Database} title="No documents yet" description="Drop a research paper, report or manual above to start building your knowledge base." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={SearchIcon} title="No matching documents" description="Try a different name or status filter." testId="documents-no-match" />
      ) : <DocumentTable docs={filtered} onDelete={onDelete} onReindex={onReindex} />}
    </Page>
  );
}
