import { Link } from "react-router-dom";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { timeAgo } from "@/lib/format";

export const ConversationList = ({ conversations, activeId, onNew, onDelete }) => (
  <div className="flex h-full flex-col" data-testid="conversation-list">
    <div className="p-3">
      <button onClick={onNew} className="nx-btn-glow flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm" data-testid="new-conversation-button">
        <MessageSquarePlus className="h-4 w-4" />New conversation
      </button>
    </div>
    <div className="nx-label px-4 pb-2 pt-1">History</div>
    <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
      {conversations.length === 0 && <p className="px-2 text-xs text-slate-500">No conversations yet.</p>}
      {conversations.map((c) => (
        <div key={c.id} className={`group flex items-center rounded-md ${c.id === activeId ? "bg-[#111B2A]" : "hover:bg-[#0E1420]"}`}>
          <Link to={`/app/chat/${c.id}`} className="min-w-0 flex-1 px-3 py-2" data-testid={`conversation-item-${c.id}`}>
            <div className={`truncate text-[13px] ${c.id === activeId ? "text-slate-100" : "text-slate-400"}`}>{c.title}</div>
            <div className="font-mono text-[10px] text-slate-600">{timeAgo(c.updated_at)}</div>
          </Link>
          <button onClick={() => onDelete(c)} aria-label="Delete conversation" data-testid={`conversation-delete-${c.id}`}
            className="mr-1 rounded p-1.5 text-slate-600 opacity-0 transition-opacity hover:text-rose-300 focus:opacity-100 group-hover:opacity-100">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  </div>
);
