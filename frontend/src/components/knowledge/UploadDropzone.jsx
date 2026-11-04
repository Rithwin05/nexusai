import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { errMsg, useApi } from "@/lib/api";

export const UploadDropzone = ({ maxMb = 20, onUploaded, autoOpen }) => {
  const api = useApi();
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  const [uploads, setUploads] = useState([]);

  const update = (name, patch) => setUploads((u) => u.map((x) => (x.name === name ? { ...x, ...patch } : x)));

  const handle = async (files) => {
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") { toast.error(`${file.name}: only PDF files are supported`); continue; }
      if (file.size > maxMb * 1024 * 1024) { toast.error(`${file.name}: exceeds the ${maxMb} MB limit`); continue; }
      setUploads((u) => [...u.filter((x) => x.name !== file.name), { name: file.name, progress: 0, state: "uploading" }]);
      const form = new FormData();
      form.append("file", file);
      try {
        await api.post("/documents/upload", form, { onUploadProgress: (e) => update(file.name, { progress: Math.round((e.loaded / (e.total || 1)) * 100) }) });
        update(file.name, { state: "done", progress: 100 });
        toast.success(`${file.name} uploaded — indexing started`);
        onUploaded?.();
      } catch (e) {
        update(file.name, { state: "error", error: errMsg(e) });
        toast.error(errMsg(e));
      }
    }
    setTimeout(() => setUploads((u) => u.filter((x) => x.state === "uploading" || x.state === "error")), 2500);
  };

  return (
    <div>
      <div role="button" tabIndex={0} data-testid="pdf-upload-dropzone"
        onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors ${
          drag ? "border-cyan-300/70 bg-cyan-400/5" : "border-[#2A3A50] bg-[#0B111C] hover:border-[#3B4F6B]"} ${autoOpen ? "ring-1 ring-cyan-400/30" : ""}`}>
        <FileUp className={`h-6 w-6 ${drag ? "text-cyan-300" : "text-slate-500"}`} strokeWidth={1.5} />
        <div className="mt-3 text-sm text-slate-200">Drop PDFs here or <span className="text-cyan-300">browse files</span></div>
        <div className="mt-1 font-mono text-[11px] text-slate-500">PDF only · up to {maxMb} MB · duplicates are detected</div>
        <input ref={input} type="file" accept="application/pdf,.pdf" multiple className="hidden" data-testid="pdf-upload-input"
          onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
      </div>
      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2" data-testid="upload-progress-list">
          {uploads.map((u) => (
            <li key={u.name} className="rounded-md border border-[#202C3D] bg-[#0E1420] px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                {u.state === "uploading" && <Loader2 className="h-3 w-3 animate-spin text-cyan-300" />}
                <span className="flex-1 truncate text-slate-300">{u.name}</span>
                <span className={`font-mono ${u.state === "error" ? "text-rose-300" : "text-slate-400"}`}>{u.state === "error" ? u.error : `${u.progress}%`}</span>
              </div>
              {u.state !== "error" && <Progress value={u.progress} className="mt-2 h-1 bg-[#111B2A]" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
