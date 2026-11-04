import { Activity, AlertTriangle, Boxes, Coins, FileText, MessageSquareText, ThumbsUp, Timer } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { ErrorState, Panel, StatCard } from "@/components/common/Blocks";
import { EvaluationLab } from "@/components/analytics/EvaluationLab";
import { useFetch } from "@/lib/api";
import { formatMs, formatNum, timeAgo } from "@/lib/format";

const TT = { contentStyle: { background: "#0E1420", border: "1px solid #202C3D", fontSize: 12 }, cursor: { fill: "#111B2A" } };

export default function Analytics() {
  const { data, error, loading, reload } = useFetch("/analytics");
  const chat = data?.ops.find((o) => o.op === "chat");
  const tokens = data?.ops.reduce((s, o) => s + o.input_tokens + o.output_tokens + o.embed_tokens, 0) || 0;
  const failures = data?.ops.reduce((s, o) => s + o.failures, 0) || 0;

  return (
    <Page>
      <PageHeader eyebrow="Analytics & Evaluation" title="Observability"
        description="Measured from recorded operations in this workspace: latency is wall-clock on the server, tokens are reported by the model APIs." />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading ? <Skeleton className="h-64 bg-[#0E1420]" /> : data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard testId="analytics-docs" label="Documents processed" value={data.documents.indexed} hint={`${data.documents.failed} failed · avg ${formatMs(data.documents.avg_processing_ms || null)}`} icon={FileText} />
            <StatCard testId="analytics-chunks" label="Chunks indexed" value={formatNum(data.chunks)} icon={Boxes} accent="violet" />
            <StatCard testId="analytics-queries" label="Chat queries" value={chat?.count || 0} hint={`${data.insufficient_answers} insufficient-evidence replies`} icon={MessageSquareText} accent="green" />
            <StatCard testId="analytics-latency" label="Avg chat latency" value={formatMs(chat?.avg_total_ms)} hint={`p95 ${formatMs(chat?.p95_total_ms)}`} icon={Timer} />
            <StatCard testId="analytics-tokens" label="Tokens (all ops)" value={formatNum(tokens)} icon={Coins} accent="amber" />
            <StatCard testId="analytics-failures" label="Recorded failures" value={failures} icon={AlertTriangle} accent="amber" />
            <StatCard testId="analytics-feedback" label="User feedback" value={`${data.feedback.up} / ${data.feedback.down}`} hint="helpful / not helpful" icon={ThumbsUp} accent="green" />
            <StatCard testId="analytics-ops" label="AI operations" value={data.ops.reduce((s, o) => s + o.count, 0)} icon={Activity} accent="violet" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Daily activity (14 days)" testId="chart-daily-activity">
              <div className="h-64"><ResponsiveContainer>
                <AreaChart data={data.series}><CartesianGrid stroke="#202C3D" strokeDasharray="3 3" /><XAxis dataKey="date" stroke="#64748B" fontSize={11} /><YAxis stroke="#64748B" fontSize={11} allowDecimals={false} />
                  <Tooltip {...TT} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="queries" stroke="#67E8F9" fill="#67E8F9" fillOpacity={0.12} />
                  <Area type="monotone" dataKey="failures" stroke="#F43F5E" fill="#F43F5E" fillOpacity={0.1} />
                </AreaChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Chat latency breakdown (last 30)" testId="chart-chat-latency">
              {data.chat_latency.length === 0 ? <p className="text-sm text-slate-500">No chat queries recorded yet.</p> : (
                <div className="h-64"><ResponsiveContainer>
                  <BarChart data={data.chat_latency.map((c, i) => ({ ...c, i: i + 1 }))}><CartesianGrid stroke="#202C3D" strokeDasharray="3 3" /><XAxis dataKey="i" stroke="#64748B" fontSize={11} /><YAxis stroke="#64748B" fontSize={11} unit="ms" />
                    <Tooltip {...TT} /><Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="retrieval" stackId="a" fill="#A78BFA" /><Bar dataKey="generation" stackId="a" fill="#67E8F9" />
                  </BarChart></ResponsiveContainer></div>
              )}
            </Panel>
          </div>
          <Panel title="Operations" testId="operations-table">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="nx-label text-left">{["Operation", "Count", "Failures", "Avg total", "p95 total", "Avg retrieval", "Avg generation", "Tokens in/out/embed"].map((h) => <th key={h} className="py-2 pr-4 font-normal">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-[#202C3D] font-mono text-xs text-slate-300">
                  {data.ops.length === 0 && <tr><td colSpan={8} className="py-4 font-sans text-sm text-slate-500">No operations recorded yet.</td></tr>}
                  {data.ops.map((o) => (
                    <tr key={o.op}><td className="py-2.5 pr-4 text-cyan-300">{o.op}</td><td className="pr-4">{o.count}</td><td className={`pr-4 ${o.failures ? "text-rose-300" : ""}`}>{o.failures}</td>
                      <td className="pr-4">{formatMs(o.avg_total_ms)}</td><td className="pr-4">{formatMs(o.p95_total_ms)}</td><td className="pr-4">{formatMs(o.avg_retrieval_ms)}</td><td className="pr-4">{formatMs(o.avg_generation_ms)}</td>
                      <td>{formatNum(o.input_tokens)} / {formatNum(o.output_tokens)} / {formatNum(o.embed_tokens)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          {data.recent_failures.length > 0 && (
            <Panel title="Recent failures" testId="recent-failures">
              <ul className="space-y-2 font-mono text-xs">{data.recent_failures.map((f, i) => (
                <li key={i} className="flex gap-3"><span className="text-rose-300">{f.op}</span><span className="flex-1 text-slate-400">{f.error}</span><span className="text-slate-600">{timeAgo(f.at)}</span></li>))}</ul>
            </Panel>
          )}
        </>
      )}
      <EvaluationLab />
    </Page>
  );
}
