import { Link } from "react-router-dom";
import { Eye, RefreshCw, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StatusPill } from "@/components/common/StatusPill";
import { formatBytes, formatMs, timeAgo } from "@/lib/format";

const IconBtn = ({ children, ...p }) => <button className="rounded p-1.5 text-slate-500 transition-colors hover:bg-[#111B2A] hover:text-slate-100 disabled:opacity-30" {...p}>{children}</button>;

export const DocumentTable = ({ docs, onDelete, onReindex }) => (
  <div className="overflow-x-auto rounded-lg border border-[#202C3D]" data-testid="documents-table">
    <table className="w-full min-w-[820px] text-sm">
      <thead className="bg-[#0B111C] text-left">
        <tr className="nx-label">{["Document", "Status", "Pages", "Chunks", "Size", "Uploaded", "Processing", ""].map((h) => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-[#202C3D]">
        {docs.map((d) => {
          const busy = d.status === "processing" || d.status === "queued";
          return (
            <tr key={d.id} className="bg-[#0E1420] transition-colors hover:bg-[#111B2A]/60" data-testid={`document-row-${d.id}`}>
              <td className="max-w-[280px] px-4 py-3">
                <Link to={`/app/knowledge/${d.id}`} className="block truncate text-slate-200 hover:text-cyan-300" data-testid={`document-link-${d.id}`}>{d.filename}</Link>
                {d.error && <div className="mt-0.5 truncate text-xs text-rose-300" title={d.error} data-testid={`document-error-${d.id}`}>{d.error}</div>}
              </td>
              <td className="px-4 py-3"><StatusPill status={d.status} stage={d.stage} progress={d.progress} testId={`document-status-${d.id}`} /></td>
              <td className="px-4 py-3 font-mono text-slate-400">{d.page_count ?? "—"}</td>
              <td className="px-4 py-3 font-mono text-slate-400" data-testid={`document-chunks-${d.id}`}>{d.chunk_count || "—"}</td>
              <td className="px-4 py-3 font-mono text-slate-400">{formatBytes(d.size)}</td>
              <td className="px-4 py-3 text-slate-400">{timeAgo(d.created_at)}</td>
              <td className="px-4 py-3 font-mono text-slate-400">{d.status === "indexed" ? formatMs(d.processing_ms) : "—"}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Link to={`/app/knowledge/${d.id}`} className="rounded p-1.5 text-slate-500 hover:bg-[#111B2A] hover:text-slate-100" aria-label="Open" data-testid={`document-open-${d.id}`}><Eye className="h-4 w-4" /></Link>
                  <IconBtn aria-label="Re-index" disabled={busy} onClick={() => onReindex(d)} data-testid={`document-reindex-${d.id}`}><RefreshCw className="h-4 w-4" /></IconBtn>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><IconBtn aria-label="Delete" disabled={d.status === "processing"} data-testid={`document-delete-${d.id}`}><Trash2 className="h-4 w-4" /></IconBtn></AlertDialogTrigger>
                    <AlertDialogContent className="border-[#202C3D] bg-[#0E1420]">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{d.filename}”?</AlertDialogTitle>
                        <AlertDialogDescription>This removes the document, all {d.chunk_count || 0} indexed chunks, its insights and benchmark questions. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-[#202C3D] bg-transparent" data-testid="delete-cancel-button">Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-rose-500 text-white hover:bg-rose-600" onClick={() => onDelete(d)} data-testid="delete-confirm-button">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
