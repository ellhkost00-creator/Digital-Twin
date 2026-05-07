import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { GitCompare } from "lucide-react";

export const Route = createFileRoute("/comparison")({
  head: () => ({
    meta: [
      { title: "Comparison — DT Lab" },
      {
        name: "description",
        content:
          "Run-vs-run comparison for voltage, line and transformer loading.",
      },
    ],
  }),
  component: Comparison,
});

function Comparison() {
  return (
    <AppShell>
      <PageHeader
        title="Comparison"
        description="Quantify differences between two completed runs across voltage and loading dimensions."
      />

      <Card className="p-12 text-center border-dashed">
        <GitCompare className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
        <div className="text-base font-semibold">No comparison data</div>
        <div className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Run-vs-run comparison requires comparison results from the backend.
          Once two completed runs are available and the comparison endpoint is
          connected, results will appear here.
        </div>
      </Card>
    </AppShell>
  );
}
