// Comparison results panel. Currently a placeholder until the backend exposes
// run-vs-run comparison data. The component renders an empty state and is
// kept exported so other pages (e.g. conversion-tools) can reuse it once
// real comparison data is wired up.
import { Card } from "@/components/ui/card";
import { GitCompare } from "lucide-react";
import type { ComparisonBundle } from "@/lib/mock-data";

export function ComparisonResults({
  result,
}: {
  result?: ComparisonBundle | null;
  runIdA?: string;
  runIdB?: string;
  labelA?: string;
  labelB?: string;
}) {
  if (!result) {
    return (
      <Card className="p-10 text-center border-dashed">
        <GitCompare className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
        <div className="text-base font-semibold">No comparison data</div>
        <div className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Backend comparison results are not available yet.
        </div>
      </Card>
    );
  }

  // Real rendering will be added when the backend returns comparison data.
  return null;
}
