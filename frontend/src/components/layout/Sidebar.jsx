import { NavLink } from "react-router-dom";
import { NAV } from "./nav";
import { Logo } from "./Logo";

export const Sidebar = ({ onNavigate, system }) => (
  <aside className="flex h-full w-[248px] flex-col border-r border-[#202C3D] bg-[#080B12]" data-testid="sidebar">
    <div className="flex h-16 items-center px-5 border-b border-[#202C3D]"><Logo /></div>
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-5">
      <div className="nx-label px-3 pb-3">Workspace</div>
      {NAV.map(({ name, icon: Icon, to, end, id, badge }) => (
        <NavLink key={id} to={to} end={end} onClick={onNavigate} data-testid={`sidebar-nav-${id}`}
          className={({ isActive }) => `group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] transition-colors ${
            isActive ? "bg-[#111B2A] text-slate-100" : "text-slate-400 hover:bg-[#0E1420] hover:text-slate-200"}`}>
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded bg-cyan-300" />}
              <Icon className={`h-4 w-4 ${isActive ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}`} strokeWidth={1.75} />
              <span className="flex-1 truncate">{name}</span>
              {badge && <span className="nx-chip border-violet-500/30 bg-violet-500/10 text-violet-300 !text-[9px] !px-1.5">{badge}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
    <div className="border-t border-[#202C3D] p-4 space-y-2" data-testid="sidebar-system-status">
      <div className="nx-label">System</div>
      <StatusRow label="Embedding key" ok={system?.embeddings_configured} />
      <StatusRow label="Generation" ok={system?.llm_configured} />
    </div>
  </aside>
);

const StatusRow = ({ label, ok }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-slate-400">{label}</span>
    <span className={`flex items-center gap-1.5 font-mono ${ok ? "text-emerald-300" : ok === false ? "text-amber-300" : "text-slate-500"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : ok === false ? "bg-amber-400" : "bg-slate-600"}`} />
      {ok ? "set" : ok === false ? "missing" : "…"}
    </span>
  </div>
);
