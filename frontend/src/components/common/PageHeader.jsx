import { motion } from "framer-motion";

export const PageHeader = ({ eyebrow, title, description, actions }) => (
  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
    className="flex flex-col gap-4 border-b border-[#202C3D] pb-6 md:flex-row md:items-end md:justify-between">
    <div className="min-w-0">
      {eyebrow && <div className="nx-label mb-2 text-cyan-300/80">{eyebrow}</div>}
      <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl" data-testid="page-title">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </motion.div>
);

export const Page = ({ children, className = "" }) => (
  <div className={`mx-auto w-full max-w-[1400px] space-y-8 px-4 py-8 sm:px-6 lg:px-10 ${className}`}>{children}</div>
);
