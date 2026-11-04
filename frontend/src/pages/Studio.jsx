import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { useWorkspace } from "@/components/layout/AppShell";
import { SummaryTab } from "@/components/studio/SummaryTab";
import { SentimentTab } from "@/components/studio/SentimentTab";
import { CompareTab } from "@/components/studio/CompareTab";
import { ExplainTab } from "@/components/studio/ExplainTab";

const TABS = [["summary", "Summarisation"], ["sentiment", "Sentiment"], ["compare", "Comparison"], ["explain", "Concept explainer"]];

export default function Studio() {
  const { documents } = useWorkspace();
  return (
    <Page>
      <PageHeader eyebrow="Intelligence Studio" title="Document intelligence workspace"
        description="Every operation reads real indexed passages. Evidence tags open the exact source chunk. Results are cached per document and can be regenerated." />
      <Tabs defaultValue="summary">
        <TabsList className="h-auto flex-wrap border border-[#202C3D] bg-[#0E1420]">
          {TABS.map(([v, l]) => <TabsTrigger key={v} value={v} data-testid={`studio-tab-${v}`}>{l}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="summary" className="mt-6"><SummaryTab documents={documents} /></TabsContent>
        <TabsContent value="sentiment" className="mt-6"><SentimentTab documents={documents} /></TabsContent>
        <TabsContent value="compare" className="mt-6"><CompareTab documents={documents} /></TabsContent>
        <TabsContent value="explain" className="mt-6"><ExplainTab /></TabsContent>
      </Tabs>
    </Page>
  );
}
