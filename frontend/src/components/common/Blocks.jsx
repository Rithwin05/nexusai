export const StatCard = ({ label, value, hint, icon: Icon, accent = "cyan", testId }) => {
  const color = { cyan: "text-cyan-300", violet: "text-violet-300", green: "text-emerald-300", amber: "text-amber-300" }[accent];
  return (
    <div className="nx-card nx-card-hover p-5" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="nx-label">{label}</span>
        {Icon && <Icon className={`h-4 w-4 ${color}`} strokeWidth={1.75} />}
      </div>
      <div className="mt-4 font-mono text-3xl font-medium tracking-tight text-slate-50" data-testid={testId ? `${testId}-value` : undefined}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
};

export const EmptyState = ({ icon: Icon, title, description, action, testId = "empty-state" }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#202C3D] px-6 py-14 text-center" data-testid={testId}>
    {Icon && <div className="mb-4 rounded-lg border border-[#202C3D] bg-[#111B2A] p-3"><Icon className="h-5 w-5 text-cyan-300" strokeWidth={1.5} /></div>}
    <div className="font-display text-base font-medium text-slate-200">{title}</div>
    {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState = ({ message, onRetry }) => (
  <div className="flex items-center justify-between gap-4 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-200" data-testid="error-state">
    <span>{message}</span>
    {onRetry && <button onClick={onRetry} className="font-mono text-xs underline underline-offset-4" data-testid="error-retry-button">Retry</button>}
  </div>
);

export const Panel = ({ title, actions, children, className = "", testId }) => (
  <section className={`nx-card min-w-0 ${className}`} data-testid={testId}>
    {title && (
      <div className="flex items-center justify-between border-b border-[#202C3D] px-5 py-3.5">
        <h3 className="font-display text-sm font-medium text-slate-200">{title}</h3>
        {actions}
      </div>
    )}
    <div className="p-5">{children}</div>
  </section>
);
