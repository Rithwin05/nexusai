import { useState } from "react";
import { CitationSheet } from "./CitationSheet";

export const useCitation = () => {
  const [active, setActive] = useState(null);
  const sheet = <CitationSheet citation={active} onClose={() => setActive(null)} />;
  return { open: setActive, sheet };
};

export const Evidence = ({ items, onOpen }) => {
  if (!items?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {items.map((e) => (
        <button key={e.tag} type="button" className="nx-citation" onClick={() => onOpen(e)} data-testid={`evidence-${e.tag}`}
          title={`${e.document_name} · p.${e.page_start ?? "n/a"}`}>
          {e.tag}{e.page_start != null && <span className="ml-1 text-cyan-500">p{e.page_start}</span>}
        </button>
      ))}
    </span>
  );
};
