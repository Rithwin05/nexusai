import { Link } from "react-router-dom";
import { Activity, Boxes, FileText, MessageSquareText, Upload, Coins, ArrowUpRight } from "lucide-react";
import { useUser } from "@clerk/react";
import { Skeleton } from "@/components/ui/skeleton";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, Panel, StatCard } from "@/components/common/Blocks";
import { StatusPill } from "@/components/common/StatusPill";
import { useFetch } from "@/lib/api";
import { formatNum, timeAgo } from "@/lib/format";

const KIND_COLORS = { upload: "bg-slate-400", indexed: "bg-emerald-400", failed: "bg-rose-400", conversation: "bg-cyan-300",
  delete: "bg-slate-600", evaluation: "bg-violet-400", research: "bg-violet-400", summary: "bg-cyan-300", sentiment: "bg-cyan-300", compare: "bg-cyan-300", explain: "bg-cyan-300" };

export default function Overview() {
  const { user } = useUser();
  const { data, error, loading, reload } = useFetch("/overview");

  return (
    <Page>
      <PageHeader eyebrow="Overview" title={`Welcome back${user?.firstName ? `, ${user.firstName}` : ""}`}
        description="A live view of your knowledge base. Every number below is computed from your workspace data."
        actions={<>
          <Link to="/app/knowledge?upload=1" className="inline-flex items-center gap-2 rounded-md border border-[#202C3D] px-4 py-2 text-sm text-slate-200 hover:border-[#334155]" data-testid="quick-upload-button"><Upload className="h-4 w-4" />Upload document</Link>
          <Link to="/app/chat" className="nx-btn-glow inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm" data-testid="quick-research-button"><MessageSquareText className="h-4 w-4" />Start research session</Link>
        </>} />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? <StatSkeleton /> : data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard testId="stat-documents" label="Indexed documents" value={formatNum(data.status_counts.indexed || 0)} hint={`${data.documents} total · ${data.status_counts.failed || 0} failed`} icon={FileText} />
            <StatCard testId="stat-chunks" label="Chunks indexed" value={formatNum(data.chunks)} hint="vectors in workspace" icon={Boxes} accent="violet" />
            <StatCard testId="stat-questions" label="Questions asked" value={formatNum(data.questions)} hint={`${data.conversations} conversations`} icon={MessageSquareText} accent="green" />
            <StatCard testId="stat-tokens" label="Tokens used" value={formatNum(data.tokens.input + data.tokens.output + data.tokens.embedding)} hint={`${formatNum(data.tokens.ai_calls)} recorded AI operations`} icon={Coins} accent="amber" />
          </div>
          {data.documents === 0 ? (
            <EmptyState icon={Upload} title="Your knowledge base is empty" testId="overview-empty-state"
              description="Upload a PDF to build your private knowledge base. NEXUS will extract, chunk and embed it so you can ask grounded questions."
              action={<Link to="/app/knowledge?upload=1" className="nx-btn-glow rounded-md px-4 py-2 text-sm" data-testid="overview-empty-upload-button">Upload your first PDF</Link>} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <RecentDocs docs={data.recent_documents} />
              <RecentConversations convs={data.recent_conversations} />
              <ActivityTimeline items={data.activity} />
            </div>
          )}
        </>
      )}
    </Page>
  );
}

const StatSkeleton = () => <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 bg-[#0E1420]" />)}</div>;

const RecentDocs = ({ docs }) => (
  <Panel title="Recent uploads" testId="recent-uploads-panel" actions={<Link to="/app/knowledge" className="text-xs text-cyan-300 hover:underline" data-testid="view-all-documents-link">View all</Link>}>
    <ul className="space-y-3">
      {docs.map((d) => (
        <li key={d.id}>
          <Link to={`/app/knowledge/${d.id}`} className="group flex items-center gap-3" data-testid={`recent-doc-${d.id}`}>
            <FileText className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="flex-1 truncate text-sm text-slate-300 group-hover:text-slate-100">{d.filename}</span>
            <StatusPill status={d.status} stage={d.stage} progress={d.progress} />
          </Link>
        </li>
      ))}
    </ul>
  </Panel>
);

const RecentConversations = ({ convs }) => (
  <Panel title="Recent conversations" testId="recent-conversations-panel">
    {convs.length === 0 ? <p className="text-sm text-slate-500">No conversations yet. Ask your first question in Research Chat.</p> : (
      <ul className="space-y-3">
        {convs.map((c) => (
          <li key={c.id}>
            <Link to={`/app/chat/${c.id}`} className="group flex items-center gap-3" data-testid={`recent-conversation-${c.id}`}>
              <MessageSquareText className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="flex-1 truncate text-sm text-slate-300 group-hover:text-slate-100">{c.title}</span>
              <span className="font-mono text-[11px] text-slate-500">{timeAgo(c.updated_at)}</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-cyan-300" />
            </Link>
          </li>
        ))}
      </ul>
    )}
  </Panel>
);

const ActivityTimeline = ({ items }) => (
  <Panel title="Knowledge activity" testId="activity-timeline" actions={<Activity className="h-4 w-4 text-slate-500" />}>
    <ol className="relative space-y-4 border-l border-[#202C3D] pl-5">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span className={`absolute -left-[23.5px] top-1.5 h-2 w-2 rounded-full ${KIND_COLORS[a.kind] || "bg-slate-500"}`} />
          <div className="text-sm text-slate-300">{a.title}</div>
          <div className="font-mono text-[11px] text-slate-500">{a.kind} · {timeAgo(a.created_at)}</div>
        </li>
      ))}
    </ol>
  </Panel>
);
