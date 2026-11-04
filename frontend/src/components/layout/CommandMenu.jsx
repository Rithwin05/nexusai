"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FileText, Upload, MessageSquarePlus } from "lucide-react";
import { NAV } from "./nav";

export const CommandMenu = ({ open, setOpen, documents = [] }) => {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
  const go = (to) => { setOpen(false); router.push(to); };
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page or document…" data-testid="command-input" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/app/knowledge?upload=1")} data-testid="command-upload"><Upload className="mr-2 h-4 w-4" />Upload document</CommandItem>
          <CommandItem onSelect={() => go("/app/chat")} data-testid="command-new-chat"><MessageSquarePlus className="mr-2 h-4 w-4" />New research session</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Navigate">
          {NAV.map((n) => (
            <CommandItem key={n.id} onSelect={() => go(n.to)} data-testid={`command-nav-${n.id}`}><n.icon className="mr-2 h-4 w-4" />{n.name}</CommandItem>
          ))}
        </CommandGroup>
        {documents.length > 0 && (
          <CommandGroup heading="Documents">
            {documents.slice(0, 20).map((d) => (
              <CommandItem key={d.id} value={`doc ${d.filename}`} onSelect={() => go(`/app/knowledge/${d.id}`)}>
                <FileText className="mr-2 h-4 w-4" />{d.filename}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};
