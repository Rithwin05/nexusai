import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { History, MessageSquareText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationList } from "@/components/chat/ConversationList";
import { AssistantMessage, UserMessage } from "@/components/chat/Messages";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { useChatStream } from "@/components/chat/useChatStream";
import { useCitation } from "@/components/common/Evidence";
import { useWorkspace } from "@/components/layout/AppShell";
import { errMsg, useApi, useFetch } from "@/lib/api";

const suggestionsFor = (docs) => {
  const d = docs.filter((x) => x.status === "indexed").slice(0, 2);
  if (!d.length) return [];
  const name = d[0].filename.replace(/\.pdf$/i, "");
  return [`What are the main findings of ${name}?`, `What methodology does ${name} use?`, `What limitations are acknowledged in ${name}?`,
    d[1] ? `How does ${name} relate to ${d[1].filename.replace(/\.pdf$/i, "")}?` : `Explain the key terminology used in ${name}.`];
};

export default function Chat() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const api = useApi();
  const { documents } = useWorkspace();
  const convs = useFetch("/conversations");
  const [input, setInput] = useState(params.get("q") || "");
  const [scope, setScope] = useState("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const citation = useCitation();
  const bottom = useRef(null);
  const onCreated = useCallback((cid) => navigate(`/app/chat/${cid}`, { replace: true }), [navigate]);
  const { messages, loading, streaming, send, stop } = useChatStream(id, { onCreated, onFinished: convs.reload });

  useEffect(() => { if (params.get("q")) setParams({}, { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  const submit = (text = input) => {
    if (!text.trim() || streaming) return;
    send(text.trim(), scope === "all" ? null : [scope]);
    setInput("");
  };
  const regenerate = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) send(lastUser.content, scope === "all" ? null : [scope], true);
  };
  const remove = async (c) => {
    try { await api.delete(`/conversations/${c.id}`); convs.reload(); if (c.id === id) navigate("/app/chat"); toast.success("Conversation deleted"); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const list = <ConversationList conversations={convs.data || []} activeId={id} onNew={() => { navigate("/app/chat"); setHistoryOpen(false); }} onDelete={remove} />;
  const indexedCount = documents.filter((d) => d.status === "indexed").length;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <aside className="hidden w-64 shrink-0 border-r border-[#202C3D] bg-[#0A0F18] md:block">{list}</aside>
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="left" className="w-72 border-[#202C3D] bg-[#0A0F18] p-0"><SheetTitle className="sr-only">Conversations</SheetTitle>{list}</SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-[#202C3D] px-4 py-2.5 md:hidden">
          <button onClick={() => setHistoryOpen(true)} className="flex items-center gap-2 text-xs text-slate-400" data-testid="open-history-button"><History className="h-4 w-4" />History</button>
        </div>
        <div className="flex-1 overflow-y-auto" data-testid="chat-thread">
          <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
            {loading && <Skeleton className="h-32 bg-[#0E1420]" />}
            {!loading && messages.length === 0 && <ChatEmpty suggestions={suggestionsFor(documents)} onPick={submit} indexedCount={indexedCount} />}
            {messages.map((m, i) => m.role === "user" ? <UserMessage key={m.id || i} m={m} /> : (
              <AssistantMessage key={m.id || `p-${i}`} m={m} streaming={m.pending && streaming} isLast={i === messages.length - 1}
                onCite={citation.open} onRegenerate={regenerate} />
            ))}
            <div ref={bottom} />
          </div>
        </div>
        <div className="border-t border-[#202C3D] bg-[#080B12] px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <ChatComposer value={input} onChange={setInput} onSend={() => submit()} onStop={stop} streaming={streaming} documents={documents} scope={scope} setScope={setScope} />
          </div>
        </div>
      </div>
      {citation.sheet}
    </div>
  );
}

const ChatEmpty = ({ suggestions, onPick, indexedCount }) => (
  <div className="pt-10" data-testid="chat-empty-state">
    <MessageSquareText className="h-6 w-6 text-cyan-300" strokeWidth={1.5} />
    <h2 className="mt-4 font-display text-2xl font-semibold text-slate-100">NEXUS Research Chat</h2>
    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
      Questions are embedded, matched against your indexed passages, and answered only from retrieved evidence with clickable citations.
      If nothing relevant passes the similarity threshold, NEXUS will say so instead of guessing.
    </p>
    {indexedCount === 0 ? (
      <div className="mt-8 rounded-lg border border-dashed border-[#202C3D] p-5 text-sm text-slate-400">
        No indexed documents yet. <Link to="/app/knowledge?upload=1" className="text-cyan-300 hover:underline" data-testid="chat-upload-link">Upload a PDF</Link> to start a grounded research session.
      </div>
    ) : (
      <div className="mt-8 grid gap-2 sm:grid-cols-2">
        {suggestions.map((s, i) => (
          <button key={s} onClick={() => onPick(s)} data-testid={`suggested-question-${i}`}
            className="flex items-start gap-2 rounded-md border border-[#202C3D] bg-[#0E1420] p-3 text-left text-sm text-slate-300 transition-colors hover:border-cyan-700/60 hover:text-slate-100">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />{s}
          </button>
        ))}
      </div>
    )}
  </div>
);
