"use client";

import { Menu, Search } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

export const Topbar = ({ workspace, onMenu, onCommand }) => (
  <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[#202C3D] bg-[#080B12]/90 px-4 backdrop-blur-xl sm:px-6" data-testid="topbar">
    <button onClick={onMenu} className="rounded-md p-2 text-slate-400 hover:bg-[#111B2A] hover:text-slate-100 lg:hidden" aria-label="Open navigation" data-testid="mobile-menu-button">
      <Menu className="h-5 w-5" />
    </button>
    <div className="hidden min-w-0 items-center gap-2 sm:flex" data-testid="current-workspace">
      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34D399]" />
      <span className="truncate text-sm text-slate-200">{workspace?.name || "Workspace"}</span>
      <span className="nx-chip border-[#202C3D] text-slate-500">private</span>
    </div>
    <button onClick={onCommand} data-testid="command-launcher-button"
      className="ml-auto flex w-full max-w-xs items-center gap-2 rounded-md border border-[#202C3D] bg-[#0E1420] px-3 py-2 text-left text-sm text-slate-500 transition-colors hover:border-[#334155] hover:text-slate-300">
      <Search className="h-4 w-4" />
      <span className="flex-1 truncate">Search or jump to…</span>
      <kbd className="hidden rounded border border-[#202C3D] px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
    </button>
    <div data-testid="user-profile-menu"><UserButton /></div>
  </header>
);
