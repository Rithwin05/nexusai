import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const DocumentSelect = ({ documents, value, onChange, placeholder = "Select a document", testId, exclude }) => {
  const indexed = documents.filter((d) => d.status === "indexed" && d.id !== exclude);
  return (
    <Select value={value || ""} onValueChange={onChange} disabled={!indexed.length}>
      <SelectTrigger className="w-full border-[#202C3D] bg-[#0E1420] sm:w-80" data-testid={testId}>
        <SelectValue placeholder={indexed.length ? placeholder : "No indexed documents yet"} />
      </SelectTrigger>
      <SelectContent className="border-[#202C3D] bg-[#0E1420]">
        {indexed.map((d) => <SelectItem key={d.id} value={d.id}>{d.filename}</SelectItem>)}
      </SelectContent>
    </Select>
  );
};
