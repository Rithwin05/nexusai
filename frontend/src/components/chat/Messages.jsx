import { useState } from "react";
import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/common/Markdown";
import { errMsg, useApi } from "@/lib/api";
import { formatMs, pages } from "@/lib/format";

const Act = ({ children, active, ...p }) => (
  <button className={`rounded p-1.5 transition-colors hover:bg-[#111B2A] ${active ? "text-cyan-300" : "text-slate-500 hover:text-slate-200"}`} {...p}>{children}</button>
);

export const UserMessage = ({ m }) => (
  <div className="flex justify-end" data-testid="chat-message-user">
    <div className="max-w-[85%] rounded-lg border border-[#202C3D] bg-[#111B2A] px-4 py-3 text-sm leading-relaxed text-slate-100 whitespace-pre-wrap">{m.content}</div>
  </div>
);

export const AssistantMessage = ({ m, streaming, isLast, onCite, onRegenerate }) => {
  const api = useApi();
  const [copied, setCopied] = useState(false);
  const [fb, setFb] = useState(m.feedback?.rating || null);
  const cites = m.citations || [];
  const openTag = (tag) => { const c = cites.find((x) => x.tag === tag); if (c) onCite(c); };
  const copy = async () => { await navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const rate = async (rating) => {
    try { await api.post(`/messages/${m.id}/feedback`, { rating }); setFb(rating); toast.success("Feedback recorded"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const ungrounded = m.metrics && !m.metrics.grounded;

  return (
    <div className="space-y-3" data-testid="chat-message-assistant">
      {ungrounded && (
        <div className="inline-flex items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 text-xs text-amber-200" data-testid="insufficient-evidence-badge">
          <ShieldAlert className="h-3.5 w-3.5" />Insufficient evidence — no generation performed
        </div>
      )}
      <div className={streaming && !m.content ? "nx-caret text-sm text-slate-500" : streaming ? "nx-caret" : ""}>
        {m.content ? <Markdown content={m.content} onCite={openTag} /> : streaming ? "Retrieving evidence" : null}
      </div>
      {cites.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2" data-testid="message-sources">
          {cites.map((c) => (
            <button key={c.tag} onClick={() => onCite(c)} data-testid={`source-card-${c.tag}`}
              className="group rounded-md border border-[#202C3D] bg-[#0B111C] p-3 text-left transition-colors hover:border-cyan-700/60">
              <div className="flex items-center gap-2 text-xs">
                <span className="nx-citation !mx-0">{c.tag}</span>
                <span className="min-w-0 flex-1 truncate text-slate-300">{c.document_name}</span>
                <span className="font-mono text-[10px] text-slate-500">{pages(c.page_start, c.page_end)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500 group-hover:text-slate-400">{c.text}</p>
              {c.similarity != null && <div className="mt-1.5 font-mono text-[10px] text-cyan-400/80">cos sim {c.similarity.toFixed(3)} · rank {c.rank}</div>}
            </button>
          ))}
        </div>
      )}
      {!streaming && m.id && (
        <div className="flex flex-wrap items-center gap-1">
          <Act onClick={copy} aria-label="Copy response" data-testid="copy-response-button">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Act>
          {isLast && <Act onClick={onRegenerate} aria-label="Regenerate" data-testid="regenerate-response-button"><RefreshCw className="h-3.5 w-3.5" /></Act>}
          <Act onClick={() => rate("up")} active={fb === "up"} aria-label="Helpful" data-testid="feedback-up-button"><ThumbsUp className="h-3.5 w-3.5" /></Act>
          <Act onClick={() => rate("down")} active={fb === "down"} aria-label="Not helpful" data-testid="feedback-down-button"><ThumbsDown className="h-3.5 w-3.5" /></Act>
          {m.metrics && (
            <span className="ml-2 font-mono text-[10px] text-slate-600" data-testid="message-metrics">
              retrieval {formatMs(m.metrics.retrieval_ms)} · generation {formatMs(m.metrics.generation_ms)} · {m.metrics.input_tokens + m.metrics.output_tokens} tokens · {m.metrics.chunks_used} chunks · {m.metrics.mode}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
