import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Database, FileSearch, GraduationCap, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/layout/Logo";

const BG = "https://images.unsplash.com/photo-1644088379091-d574269d422f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1800";

const CAPS = [
  { icon: Database, title: "Knowledge Intelligence", text: "Ingest PDFs, extract page-aware text, chunk with overlap and index 1,536-dim embeddings." },
  { icon: MessageSquareText, title: "Contextual AI", text: "Answers grounded only in retrieved passages, with inspectable citations down to the page." },
  { icon: FileSearch, title: "Semantic Discovery", text: "Search by meaning, by keyword, or both with reciprocal-rank fusion." },
  { icon: Sparkles, title: "Intelligence Studio", text: "Summaries, sentiment, document comparison and concept explanations from real content." },
  { icon: GraduationCap, title: "Research Intelligence", text: "Objectives, methodology, findings, limitations — and an evidence-backed Research Gap Finder." },
  { icon: BarChart3, title: "Evaluation & Observability", text: "Measured latency, token usage, failures, feedback and Recall@K / Precision@K benchmarks." },
];

const FLOW = ["Upload knowledge", "Understand", "Discover connections", "Ask questions", "Evidence-backed answers"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#080B12] text-slate-100">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Logo />
        <Link to="/sign-in" className="nx-btn-glow rounded-md px-4 py-2 text-sm" data-testid="landing-signin-button">Sign in</Link>
      </header>

      <section className="relative overflow-hidden">
        <img src={BG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.18]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080B12]/40 via-[#080B12]/70 to-[#080B12]" />
        <div className="nx-grid-bg absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.15fr_1fr] lg:pt-24">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="nx-label mb-6 text-cyan-300/90">The Intelligent Knowledge Operating System</div>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Your Knowledge.<br /><span className="text-cyan-300">Connected.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400">
              Transform disconnected documents into searchable, contextual, actionable intelligence. NEXUS retrieves the evidence first,
              then answers — and tells you plainly when the evidence isn't there.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/sign-in" className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-5 py-3 text-sm font-semibold text-[#080B12] transition-colors hover:bg-cyan-200" data-testid="landing-get-started-button">
                Continue with Google <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#capabilities" className="rounded-md border border-[#202C3D] px-5 py-3 text-sm text-slate-300 transition-colors hover:border-[#334155]" data-testid="landing-learn-more-link">Explore capabilities</a>
            </div>
            <div className="mt-10 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-400" />Private workspace · document text treated as untrusted data · keys stay server-side</div>
          </motion.div>
          <PipelineCard />
        </div>
      </section>

      <section id="capabilities" className="mx-auto max-w-7xl px-6 py-24">
        <div className="nx-label mb-3">Six interconnected capabilities</div>
        <h2 className="max-w-2xl font-display text-2xl font-semibold tracking-tight sm:text-3xl">Not another PDF chatbot — a research workstation.</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-[#202C3D] bg-[#202C3D] sm:grid-cols-2 lg:grid-cols-3">
          {CAPS.map((c, i) => (
            <motion.div key={c.title} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="bg-[#0B111C] p-7 transition-colors hover:bg-[#0E1420]">
              <c.icon className="h-5 w-5 text-cyan-300" strokeWidth={1.5} />
              <div className="mt-5 font-display text-base font-medium">{c.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{c.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#202C3D] bg-[#0B111C]">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-4 md:grid-cols-5">
            {FLOW.map((f, i) => (
              <div key={f} className="flex items-center gap-3">
                <span className="font-mono text-xs text-violet-300">0{i + 1}</span>
                <span className="text-sm text-slate-300">{f}</span>
                {i < FLOW.length - 1 && <span className="hidden flex-1 border-t border-dashed border-[#334155] md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-10 text-xs text-slate-500 sm:flex-row sm:items-center">
        <Logo />
        <span>Retrieval-augmented generation · cosine similarity · hybrid RRF · measured, never invented.</span>
      </footer>
    </div>
  );
}

const PipelineCard = () => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
    className="nx-card self-center p-6 shadow-2xl shadow-black/60" data-testid="landing-pipeline-card">
    <div className="flex items-center justify-between">
      <span className="nx-label">RAG pipeline</span>
      <span className="nx-chip border-emerald-500/30 bg-emerald-500/10 text-emerald-300">grounded</span>
    </div>
    <div className="mt-5 space-y-2.5 font-mono text-[12px]">
      {[["embed(query)", "text-embedding-3-small · 1536d"], ["retrieve()", "cosine ∪ keyword → RRF"], ["filter()", "workspace scope · sim ≥ threshold"],
        ["context()", "<source> blocks, untrusted"], ["generate()", "cite [S#] or report insufficient"]].map(([fn, d], i) => (
        <div key={fn} className="flex items-center gap-3 rounded-md border border-[#202C3D] bg-[#080B12] px-3 py-2.5">
          <span className="text-slate-600">{i + 1}</span>
          <span className="text-cyan-300">{fn}</span>
          <span className="ml-auto truncate text-slate-500">{d}</span>
        </div>
      ))}
    </div>
    <div className="mt-5 rounded-md border border-[#202C3D] bg-[#111B2A] p-4 text-[13px] leading-relaxed text-slate-300">
      LoRA reduces trainable parameters by injecting low-rank matrices <span className="nx-citation">S1</span> while quantisation lowers memory footprint <span className="nx-citation">S3</span>.
      <div className="mt-2 font-mono text-[10px] text-slate-500">illustrative answer format</div>
    </div>
  </motion.div>
);
