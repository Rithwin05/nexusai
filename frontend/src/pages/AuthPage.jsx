import { Logo } from "@/components/layout/Logo";

export default function AuthPage({ children }) {
  return (
    <div className="flex min-h-screen bg-[#080B12]">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden border-r border-[#202C3D] p-12 lg:flex">
        <div className="nx-grid-bg absolute inset-0 opacity-50" />
        <div className="relative"><Logo /></div>
        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight text-slate-100">Upload knowledge. Ask intelligent questions. Receive evidence-backed answers.</h2>
          <p className="mt-4 text-sm text-slate-400">Every workspace is private to its owner and every answer links back to its source passage.</p>
        </div>
        <div className="relative nx-label">NEXUS AI · Knowledge OS</div>
      </div>
      <div className="flex flex-1 items-center justify-center p-6" data-testid="auth-container">{children}</div>
    </div>
  );
}
