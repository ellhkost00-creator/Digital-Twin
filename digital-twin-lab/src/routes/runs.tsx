import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { seedNetworks } from "@/lib/networks-store";
import { fetchSimbenchNetworks } from "@/lib/api";
import { AppShell, PageHeader, StatusBadge } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useRuns } from "@/lib/runs-store";
import { Search, RefreshCw, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/runs")({
  loader: () => fetchSimbenchNetworks(),
  validateSearch: (search: Record<string, unknown>): { highlight?: string } => ({
    highlight: typeof search.highlight === "string" ? search.highlight : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Simulation Runs — DT Lab" },
      { name: "description", content: "Track queued, running, completed and failed simulation jobs." },
    ],
  }),
  component: SimulationRuns,
});

function SimulationRuns() {
  const loaderData = Route.useLoaderData();
  useEffect(() => {
    seedNetworks(loaderData.networks);
  }, [loaderData.networks]);

  const runs = useRuns();
  const { highlight } = Route.useSearch();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);
  const [flashRunId, setFlashRunId] = useState<string | undefined>(highlight);

  // Scroll & flash the highlighted run when it appears
  useEffect(() => {
    if (!highlight) return;
    setFlashRunId(highlight);
    const t1 = setTimeout(() => {
      highlightedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    const t2 = setTimeout(() => setFlashRunId(undefined), 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [highlight]);

  const filtered = runs.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (q === "" || r.scenarioName.toLowerCase().includes(q.toLowerCase()) || r.id.includes(q)),
  );

  return (
    <AppShell>
      <PageHeader
        title="Simulation Runs"
        description="Monitor the simulation queue and inspect completed jobs."
        actions={
          <Button variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {(["queued", "running", "completed", "failed"] as const).map((s) => {
          const n = runs.filter((r) => r.status === s).length;
          return (
            <Card key={s} className="p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium capitalize">
                {s}
              </div>
              <div className="mt-2 text-3xl font-semibold">{n}</div>
              <div className="mt-2"><StatusBadge status={s} /></div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search runs by scenario or ID…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4 font-medium">Run ID</th>
                <th className="py-3 px-4 font-medium">Scenario</th>
                <th className="py-3 px-4 font-medium">Network</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Progress</th>
                <th className="py-3 px-4 font-medium">Started</th>
                <th className="py-3 px-4 font-medium">Duration</th>
                <th className="py-3 px-4 font-medium text-center">Violations</th>
                <th className="py-3 px-4 text-center" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isFlash = r.id === flashRunId;
                return (
                <tr
                  key={r.id}
                  ref={isFlash ? highlightedRowRef : undefined}
                  className={
                    "border-t border-border transition-colors " +
                    (isFlash ? "bg-primary/10 animate-pulse" : "hover:bg-muted/30")
                  }
                >
                  <td className="py-3 px-4 font-mono text-xs">{r.id}</td>
                  <td className="py-3 px-4 font-medium">{r.scenarioName}</td>
                  <td className="py-3 px-4 text-muted-foreground">{r.networkName}</td>
                  <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                  <td className="py-3 px-4 w-44">
                    <div className="flex items-center gap-2">
                      <Progress value={r.progress} className="h-1.5" />
                      <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{r.progress}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{r.startedAt}</td>
                  <td className="py-3 px-4 font-mono text-xs">{r.duration}</td>
                  <td className="py-3 px-4 font-mono text-center">
                    {r.violations > 0 ? (
                      <Link
                        to="/results"
                        search={{ runId: r.id }}
                        className="text-primary hover:underline"
                      >
                        {r.violations}
                      </Link>
                    ) : (
                      r.violations
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {r.status === "completed" ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/results" search={{ runId: r.id }}>
                          <BarChart3 className="h-4 w-4 mr-1" /> Results
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground px-2">—</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
