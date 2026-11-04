"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { Panel } from "@/components/common/Blocks";
import { useWorkspace } from "@/components/layout/AppShell";
import { errMsg, useApi } from "@/lib/api";

const Field = ({ label, hint, value, children }) => (
  <div>
    <div className="flex items-center justify-between"><span className="text-sm text-slate-200">{label}</span>{value != null && <span className="font-mono text-xs text-cyan-300">{value}</span>}</div>
    {hint && <p className="mb-3 mt-0.5 text-xs text-slate-500">{hint}</p>}
    {children}
  </div>
);

export default function Settings() {
  const api = useApi();
  const { workspace, reloadWorkspace } = useWorkspace();
  const [s, setS] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (workspace) { setS(workspace.settings); setName(workspace.name); } }, [workspace]);
  if (!s) return <Page><Loader2 className="h-5 w-5 animate-spin text-slate-500" /></Page>;
  const set = (k) => (v) => setS({ ...s, [k]: v });
  const sys = workspace.system;
  const overlapInvalid = s.chunk_overlap >= Math.floor(s.chunk_size / 2);

  const save = async () => {
    setSaving(true);
    try { await api.put("/workspace/settings", { ...s, workspace_name: name }); toast.success("Settings saved"); reloadWorkspace(); }
    catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <Page>
      <PageHeader eyebrow="Settings" title="Workspace & retrieval configuration"
        actions={<button onClick={save} disabled={saving || overlapInvalid} className="nx-btn-glow inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm disabled:opacity-40" data-testid="settings-save-button">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save changes</button>} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Workspace">
            <Field label="Workspace name"><Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm border-[#202C3D] bg-[#080B12]" data-testid="settings-workspace-name-input" /></Field>
          </Panel>
          <Panel title="Retrieval (chat, explainer)">
            <div className="space-y-7">
              <Field label="Retrieval mode" hint="Hybrid fuses cosine-similarity ranking with keyword ranking (RRF, k=60).">
                <Select value={s.mode} onValueChange={set("mode")}>
                  <SelectTrigger className="max-w-xs border-[#202C3D] bg-[#080B12]" data-testid="settings-mode-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-[#202C3D] bg-[#0E1420]">{["semantic", "keyword", "hybrid"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Top-K passages" value={s.top_k} hint="Passages passed to the model as context."><Slider value={[s.top_k]} min={1} max={20} step={1} onValueChange={([v]) => set("top_k")(v)} data-testid="settings-topk-slider" /></Field>
              <Field label="Similarity threshold" value={s.threshold.toFixed(2)} hint="Minimum cosine similarity. Below it, NEXUS reports insufficient evidence instead of answering.">
                <Slider value={[s.threshold]} min={0} max={0.9} step={0.01} onValueChange={([v]) => set("threshold")(v)} data-testid="settings-threshold-slider" />
              </Field>
              <Field label="Generation model">
                <Select value={s.llm_model} onValueChange={set("llm_model")}>
                  <SelectTrigger className="max-w-xs border-[#202C3D] bg-[#080B12]" data-testid="settings-model-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-[#202C3D] bg-[#0E1420]">{workspace.allowed_models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          </Panel>
          <Panel title="Chunking (applies to new uploads and re-indexing)">
            <div className="space-y-7">
              <Field label="Chunk size (characters)" value={s.chunk_size}><Slider value={[s.chunk_size]} min={300} max={4000} step={50} onValueChange={([v]) => set("chunk_size")(v)} data-testid="settings-chunk-size-slider" /></Field>
              <Field label="Chunk overlap (characters)" value={s.chunk_overlap} hint="Must be less than half the chunk size."><Slider value={[s.chunk_overlap]} min={0} max={1000} step={25} onValueChange={([v]) => set("chunk_overlap")(v)} data-testid="settings-chunk-overlap-slider" />
                {overlapInvalid && <p className="mt-2 text-xs text-rose-300" data-testid="settings-overlap-error">Overlap must be less than {Math.floor(s.chunk_size / 2)} characters (half the chunk size).</p>}</Field>
            </div>
          </Panel>
        </div>
        <Panel title="System status" testId="settings-system-status">
          <dl className="space-y-3 text-sm">
            {[["Embeddings", sys.embeddings_configured ? "configured" : "OPENAI_API_KEY missing", sys.embeddings_configured],
              ["Generation (LLM)", sys.llm_configured ? "configured" : "missing", sys.llm_configured],
              ["Embedding model", `${sys.embedding_model} · ${sys.embedding_dim}d`], ["Vector store", sys.vector_store], ["Keyword index", sys.keyword_index],
              ["Upload limit", `${sys.max_upload_mb} MB · PDF only`]].map(([k, v, ok]) => (
              <div key={k} className="flex flex-col gap-0.5 border-b border-[#202C3D] pb-3 last:border-0">
                <dt className="nx-label">{k}</dt>
                <dd className={`font-mono text-xs ${ok === false ? "text-amber-300" : ok ? "text-emerald-300" : "text-slate-300"}`}>{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </Page>
  );
}
