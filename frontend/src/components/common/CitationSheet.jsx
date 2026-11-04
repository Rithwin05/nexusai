import { useNavigate } from "react-router-dom";
import { ExternalLink, FileText } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { pages } from "@/lib/format";

export const CitationMeta = ({ c }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {c.rank != null && <span className="nx-chip border-[#202C3D] text-slate-400">rank #{c.rank}</span>}
    {c.similarity != null && <span className="nx-chip border-cyan-700/50 bg-cyan-950/60 text-cyan-300" title="Cosine similarity between query and passage embeddings (higher = closer)">cos sim {c.similarity.toFixed(3)}</span>}
    {c.keyword_score != null && <span className="nx-chip border-violet-500/30 bg-violet-500/10 text-violet-300" title="MongoDB text-search relevance score">kw {c.keyword_score.toFixed(2)}</span>}
    <span className="nx-chip border-[#202C3D] text-slate-400">{pages(c.page_start, c.page_end)}</span>
    <span className="nx-chip border-[#202C3D] text-slate-500">chunk {c.ordinal}</span>
  </div>
);

export const CitationSheet = ({ citation, onClose }) => {
  const navigate = useNavigate();
  return (
    <Sheet open={Boolean(citation)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full border-[#202C3D] bg-[#0B111C] sm:max-w-lg overflow-y-auto" data-testid="citation-panel">
        {citation && (
          <>
            <SheetHeader className="text-left">
              <div className="nx-label text-cyan-300/80">Source {citation.tag}</div>
              <SheetTitle className="flex items-start gap-2 font-display text-lg text-slate-100">
                <FileText className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />{citation.document_name}
              </SheetTitle>
              <SheetDescription asChild><div><CitationMeta c={citation} /></div></SheetDescription>
            </SheetHeader>
            <div className="mt-6 rounded-md border border-[#202C3D] bg-[#080B12] p-4 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap" data-testid="citation-excerpt">
              {citation.text}
            </div>
            <button data-testid="citation-open-document-button"
              onClick={() => navigate(`/app/knowledge/${citation.document_id}?chunk=${citation.chunk_id}`)}
              className="nx-btn-glow mt-5 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm">
              <ExternalLink className="h-4 w-4" /> Open in document & highlight
            </button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
