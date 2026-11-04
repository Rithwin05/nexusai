import { createContext, useContext, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useFetch } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandMenu } from "./CommandMenu";

const WorkspaceCtx = createContext(null);
export const useWorkspace = () => useContext(WorkspaceCtx);

export default function AppShell() {
  const ws = useFetch("/workspace");
  const docs = useFetch("/documents");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <WorkspaceCtx.Provider value={{ workspace: ws.data, reloadWorkspace: ws.reload, documents: docs.data || [], reloadDocuments: docs.reload }}>
      <div className="flex h-screen overflow-hidden bg-[#080B12] text-slate-100">
        <div className="hidden lg:block"><Sidebar system={ws.data?.system} /></div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[248px] border-[#202C3D] bg-[#080B12] p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Sidebar system={ws.data?.system} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar workspace={ws.data} onMenu={() => setMobileOpen(true)} onCommand={() => setCmdOpen(true)} />
          <main key={pathname.split("/")[2] || "overview"} className="relative flex-1 overflow-y-auto" data-testid="main-content">
            <Outlet />
          </main>
        </div>
        <CommandMenu open={cmdOpen} setOpen={setCmdOpen} documents={docs.data || []} />
      </div>
    </WorkspaceCtx.Provider>
  );
}
