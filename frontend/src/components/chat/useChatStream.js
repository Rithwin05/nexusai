import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useApi } from "@/lib/api";

export function useChatStream(conversationId, { onCreated, onFinished }) {
  const api = useApi();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);
  const skipLoadRef = useRef(null);

  useEffect(() => {
    if (!conversationId) { setMessages([]); return; }
    if (skipLoadRef.current === conversationId) { skipLoadRef.current = null; return; }
    setLoading(true);
    api.get(`/conversations/${conversationId}`).then((r) => setMessages(r.data.messages))
      .catch(() => toast.error("Could not load conversation")).finally(() => setLoading(false));
  }, [api, conversationId]);

  const send = useCallback(async (question, documentIds, regenerate = false) => {
    const pending = { role: "assistant", content: "", citations: [], pending: true };
    setMessages((m) => {
      const base = regenerate ? m.slice(0, -2) : m;
      return [...base, { role: "user", content: question, id: `local-${Date.now()}` }, pending];
    });
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patchLast = (fn) => setMessages((m) => [...m.slice(0, -1), fn(m[m.length - 1])]);
    try {
      await api.stream("/chat/stream", { question, conversation_id: conversationId, document_ids: documentIds, regenerate }, (ev) => {
        if (ev.type === "meta" && !conversationId) { skipLoadRef.current = ev.conversation_id; onCreated?.(ev.conversation_id); }
        if (ev.type === "sources") patchLast((x) => ({ ...x, citations: ev.citations }));
        if (ev.type === "delta") patchLast((x) => ({ ...x, content: x.content + ev.content }));
        if (ev.type === "done") patchLast(() => ev.message);
        if (ev.type === "error") { patchLast((x) => ({ ...x, content: x.content || `**Error:** ${ev.message}`, pending: false, error: true })); toast.error(ev.message); }
      }, ctrl.signal);
    } catch (e) {
      if (e.name !== "AbortError") { toast.error(e.message); patchLast((x) => ({ ...x, content: `**Error:** ${e.message}`, error: true, pending: false })); }
      else patchLast((x) => ({ ...x, pending: false, content: x.content + "\n\n_(stopped)_" }));
    } finally {
      setStreaming(false);
      onFinished?.();
    }
  }, [api, conversationId, onCreated, onFinished]);

  const stop = () => abortRef.current?.abort();
  return { messages, loading, streaming, send, stop };
}
