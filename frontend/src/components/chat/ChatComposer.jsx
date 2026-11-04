import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const ChatComposer = ({ value, onChange, onSend, onStop, streaming, documents, scope, setScope }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 200)}px`; }
  }, [value]);
  const indexed = documents.filter((d) => d.status === "indexed");
  return (
    <div className="rounded-lg border border-[#202C3D] bg-[#0E1420] p-2 focus-within:border-[#334155]">
      <textarea ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value)} data-testid="chat-input-textarea"
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!streaming) onSend(); } }}
        placeholder="Ask a question about your knowledge base…  (Shift+Enter for a new line)"
        className="w-full resize-none bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none" />
      <div className="flex items-center gap-2">
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="h-8 w-auto max-w-[240px] border-[#202C3D] bg-[#080B12] text-xs" data-testid="chat-scope-select"><SelectValue /></SelectTrigger>
          <SelectContent className="border-[#202C3D] bg-[#0E1420]">
            <SelectItem value="all">All documents ({indexed.length})</SelectItem>
            {indexed.map((d) => <SelectItem key={d.id} value={d.id}>{d.filename}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="hidden font-mono text-[10px] text-slate-600 sm:inline">grounded · cited</span>
        {streaming ? (
          <button onClick={onStop} className="ml-auto rounded-md border border-[#202C3D] p-2 text-slate-300 hover:bg-[#111B2A]" aria-label="Stop" data-testid="chat-stop-button"><Square className="h-4 w-4" /></button>
        ) : (
          <button onClick={onSend} disabled={!value.trim()} className="ml-auto rounded-md bg-cyan-300 p-2 text-[#080B12] transition-colors hover:bg-cyan-200 disabled:opacity-30" aria-label="Send" data-testid="chat-send-button"><ArrowUp className="h-4 w-4" /></button>
        )}
      </div>
    </div>
  );
};
