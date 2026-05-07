import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader, StatusBadge } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import type { Network } from "@/lib/mock-data";
import { fetchSimbenchNetworks, runOpenDSSSimulation, type OpenDSSRunResult } from "@/lib/api";
import {
  ArrowLeft, Cable, Zap, Box, Plug, Download, Play,
  CalendarDays, Loader2, AlertCircle, CheckCircle2, BarChart3,
} from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";

interface LoaderData {
  network: Network;
  serviceUrl: string | null;
}

export const Route = createFileRoute("/networks/$networkId")({
  head: ({ loaderData }) => {
    const n = (loaderData as LoaderData | undefined)?.network;
    return {
      meta: [
        { title: `${n?.name ?? "Network"} — DT Lab` },
        { name: "description", content: `Asset summary and details for ${n?.name ?? "this network"}.` },
      ],
    };
  },
  loader: async ({ params }): Promise<LoaderData> => {
    const result = await fetchSimbenchNetworks();
    const n = result.networks.find((x) => x.id === params.networkId);
    if (!n) {
      const { notFound } = await import("@tanstack/react-router");
      throw notFound();
    }
    return { network: n, serviceUrl: result.serviceUrl };
  },
  component: NetworkDetail,
});

// ── Utilities ───────────────────────────────────────────────────────────────

function isOpenDSS(networkId: string) {
  return networkId.startsWith("opendss-");
}

function dayToLabel(day: number): string {
  return new Date(2023, 0, day).toLocaleDateString("en-AU", { month: "long", day: "numeric" });
}

function dayToSeason(day: number): string {
  if (day >= 355 || day <= 78)  return "Summer";
  if (day <= 170)               return "Autumn";
  if (day <= 263)               return "Winter";
  return "Spring";
}

// ── OpenDSS run panel ───────────────────────────────────────────────────────

type RunState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; result: OpenDSSRunResult }
  | { phase: "error"; message: string };

function OpenDSSRunPanel({ networkId, mode }: { networkId: string; mode: string }) {
  const [day, setDay] = useState(15);
  const [runState, setRunState] = useState<RunState>({ phase: "idle" });

  async function handleRun() {
    setRunState({ phase: "running" });
    try {
      const result = await runOpenDSSSimulation(networkId, day);
      setRunState({ phase: "done", result });
    } catch (err) {
      setRunState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const isRunning = runState.phase === "running";
  const dateLabel = dayToLabel(day);
  const season    = dayToSeason(day);

  return (
    <Card className="p-5">
      <div className="text-sm font-semibold mb-4">Run Simulation</div>

      {/* Day picker */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{dateLabel}</span>
            <Badge variant="secondary" className="text-[10px]">{season}</Badge>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">Day {day} / 365</span>
        </div>
        <Slider
          min={1} max={365} step={1}
          value={[day]}
          onValueChange={([v]) => setDay(v)}
          disabled={isRunning}
          className="w-full"
        />
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span><span>Dec</span>
        </div>
      </div>

      {/* Mode display */}
      <div className="flex items-center justify-between text-sm mb-5">
        <span className="text-muted-foreground">Mode</span>
        <Badge variant="outline" className="capitalize">{mode}</Badge>
      </div>

      {/* Result / error */}
      {runState.phase === "done" && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Completed in {runState.result.duration_seconds}s</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ["Under V", runState.result.violations.under_voltage],
              ["Over V",  runState.result.violations.over_voltage],
              ["Line",    runState.result.violations.line_overload],
              ["Trafo",   runState.result.violations.trafo_overload],
            ].map(([label, val]) => (
              <div key={label} className={cn(
                "rounded-lg border px-3 py-2 flex items-center justify-between",
                Number(val) > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/20",
              )}>
                <span className="text-muted-foreground">{label}</span>
                <span className={cn("font-semibold", Number(val) > 0 && "text-destructive")}>{val}</span>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" size="sm" className="w-full gap-2 mt-1">
            <Link to="/results" search={{ runId: runState.result.run_id, networkId }}>
              <BarChart3 className="h-4 w-4" /> View Results
            </Link>
          </Button>
        </div>
      )}

      {runState.phase === "error" && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all">
            {runState.message}
          </p>
        </div>
      )}

      <Button
        className="w-full gap-2"
        disabled={isRunning}
        onClick={handleRun}
      >
        {isRunning ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
        ) : (
          <><Play className="h-4 w-4" /> Run Simulation</>
        )}
      </Button>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

function NetworkDetail() {
  const data = Route.useLoaderData() as LoaderData;
  const n = data.network;
  const serviceUrl = data.serviceUrl;
  const { role } = useRole();
  const canCreateScenario = role === "admin" || role === "researcher";

  const assets = [
    { label: "Buses",        value: n.buses,        icon: Box,  tone: "text-info" },
    { label: "Lines",        value: n.lines,        icon: Cable, tone: "text-primary" },
    { label: "Transformers", value: n.transformers, icon: Zap,  tone: "text-warning-foreground" },
    { label: "Loads",        value: n.loads,        icon: Plug, tone: "text-success" },
  ];

  const plotSrc = n.plot_url && serviceUrl ? `${serviceUrl}${n.plot_url}` : null;
  const opendss = isOpenDSS(n.id);
  const opendssMode = opendss ? n.id.split("-")[2] : null;

  return (
    <AppShell>
      <Link to="/networks" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3 w-3" /> Back to Network Library
      </Link>

      <PageHeader
        title={n.name}
        description={`${n.type} network · ${n.voltage} · ${n.version}`}
        actions={
          <>
            <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Export</Button>
            {!opendss && canCreateScenario && (
              <Button asChild>
                <Link to="/scenarios" search={{ networkId: n.id }}>
                  <Play className="h-4 w-4 mr-2" /> New scenario
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Asset counters */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {assets.map((a) => {
          const Icon = a.icon;
          return (
            <Card key={a.label} className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{a.label}</div>
                <Icon className={"h-4 w-4 " + a.tone} />
              </div>
              <div className="mt-2 text-3xl font-semibold">{a.value}</div>
            </Card>
          );
        })}
      </div>

      {/* Main grid: topology + sidebar */}
      <div className={cn(
        "grid grid-cols-1 gap-4",
        "xl:grid-cols-[2fr_1fr] xl:h-[640px]",
      )}>
        {/* Topology */}
        <Card className={cn("p-0 flex flex-col min-h-0", opendss ? "overflow-auto" : "overflow-hidden")}>
          <div className="px-5 pt-5 pb-3 text-sm font-semibold shrink-0">Topology overview</div>
          {plotSrc ? (
            opendss ? (
              <iframe
                src={plotSrc}
                title={`${n.name} topology plot`}
                style={{ width: 900, height: 600, border: 0, display: "block" }}
                scrolling="no"
              />
            ) : (
              <iframe
                src={plotSrc}
                title={`${n.name} topology plot`}
                className="w-full flex-1 border-0 block min-h-0"
              />
            )
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm border-t border-dashed border-border bg-muted/30">
              No topology plot available
            </div>
          )}
        </Card>

        {/* Sidebar: metadata + optional run panel */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          <Card className="p-5">
            <div className="text-sm font-semibold mb-4">Metadata</div>
            <dl className="space-y-3 text-sm">
              {[
                ["Network ID",    n.id],
                ["Voltage level", n.voltage],
                ["Type",          n.type],
                ["Version",       n.version],
                ["Created",       n.created],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-xs">{v}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd><StatusBadge status={n.status} /></dd>
              </div>
            </dl>
          </Card>

          {opendss && opendssMode && (
            <OpenDSSRunPanel networkId={n.id} mode={opendssMode} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
