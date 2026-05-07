import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Scenario } from "@/lib/mock-data";
import { useScenarios, createScenario } from "@/lib/scenarios-store";
import { createRun, removeRun } from "@/lib/runs-store";
import { useNetworks } from "@/lib/networks-store";
import {
  runSimulation,
  runOpenDSSSimulation,
  buildResultUrl,
  type OpenDSSRunResult,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Play, Wand2, Layers, CalendarClock, Loader2,
  CalendarDays, CheckCircle2, AlertCircle, BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/scenarios")({
  validateSearch: (search: Record<string, unknown>): { networkId?: string } => {
    const nid = typeof search.networkId === "string" ? search.networkId : undefined;
    return nid ? { networkId: nid } : {};
  },
  head: () => ({
    meta: [
      { title: "Scenario Builder — DT Lab" },
      { name: "description", content: "Configure simulation scenarios for distribution networks." },
    ],
  }),
  component: ScenarioBuilder,
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Mode = "balanced" | "unbalanced";
type Horizon = "day" | "week" | "month";

type OpenDSSRunState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; result: OpenDSSRunResult }
  | { phase: "error"; message: string };

function dayToLabel(day: number): string {
  return new Date(2023, 0, day).toLocaleDateString("en-AU", { month: "long", day: "numeric" });
}

function dayToSeason(day: number): string {
  if (day >= 355 || day <= 78) return "Summer";
  if (day <= 170)              return "Autumn";
  if (day <= 263)              return "Winter";
  return "Spring";
}

function ScenarioBuilder() {
  const networks = useNetworks();
  const scenarios = useScenarios();
  const { networkId: presetNetworkId } = Route.useSearch();

  const [name, setName] = useState("New scenario");
  const initialNetworkId =
    presetNetworkId && networks.some((n) => n.id === presetNetworkId)
      ? presetNetworkId
      : (networks[0]?.id ?? "");
  const [networkId, setNetworkId] = useState(initialNetworkId);
  const [mode, setMode] = useState<Mode>("balanced");
  const [horizon, setHorizon] = useState<Horizon>("day");

  const [year, setYear] = useState<number>(2016);
  const [month, setMonth] = useState("1");
  const [day, setDay] = useState("1");

  const [submitting, setSubmitting] = useState(false);
  const [lastResultUrls, setLastResultUrls] = useState<Record<string, string>>({});
  const [lastRunId, setLastRunId] = useState<string | null>(null);

  // ── OpenDSS-specific state ──────────────────────────────────────────────────
  const [opendssDay, setOpendssDay] = useState(15);
  const [opendssRunState, setOpendssRunState] = useState<OpenDSSRunState>({ phase: "idle" });

  const isOpenDSSNetwork = networkId.startsWith("opendss-");
  const opendssMode = isOpenDSSNetwork ? networkId.split("-")[2] : null;
  const dateLabel = dayToLabel(opendssDay);
  const season = dayToSeason(opendssDay);

  // ── Standard SimBench handler ───────────────────────────────────────────────
  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!networkId) { toast.error("Please select a network"); return; }
    setSubmitting(true);
    setLastResultUrls({});
    setLastRunId(null);

    const tempRunId = `run-pending-${Date.now()}`;
    const pendingScenario: Scenario = {
      id: `scn-${Date.now()}`,
      name,
      networkId,
      simType: "time_series",
      mode,
      horizon,
      timestep: "—",
      createdBy: "E. Marchetti",
      createdAt: new Date().toISOString().slice(0, 10),
    };
    await createScenario(pendingScenario);
    createRun({
      scenarioId: pendingScenario.id,
      scenarioName: pendingScenario.name,
      networkName: networks.find((n) => n.id === networkId)?.name,
      runId: tempRunId,
      networkId,
      status: "running",
    });

    try {
      const result = await runSimulation({
        networkId,
        horizon,
        year,
        month: Number(month),
        day: horizon === "month" ? undefined : Number(day),
      });

      const candidate = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
      const runId =
        (typeof candidate.run_id === "string" && candidate.run_id) ||
        (typeof candidate.runId === "string" && candidate.runId) ||
        (typeof candidate.id === "string" && candidate.id) ||
        null;

      if (!runId) throw new Error("Backend did not return a run_id");

      const urls: Record<string, string> = {
        vm_pu: buildResultUrl(networkId, runId, "vm-pu"),
        line_loading: buildResultUrl(networkId, runId, "line-loading"),
        trafo_loading: buildResultUrl(networkId, runId, "trafo-loading"),
      };
      setLastResultUrls(urls);
      setLastRunId(runId);

      try {
        const networkObj = networks.find((n) => n.id === networkId);
        sessionStorage.setItem("lastSimulationResult", JSON.stringify({
          networkId,
          networkName: networkObj?.name ?? networkId,
          runId, urls, horizon, mode, year,
          month: Number(month),
          day: horizon === "month" ? null : Number(day),
          raw: result ?? null,
          at: new Date().toISOString(),
        }));
      } catch {}

      toast.success(`Simulation completed — run ${runId}`);
      removeRun(tempRunId);
      createRun({
        scenarioId: pendingScenario.id,
        scenarioName: pendingScenario.name,
        networkName: networks.find((n) => n.id === networkId)?.name,
        runId,
        networkId,
        startedAtIso: typeof candidate.started_at === "string" ? candidate.started_at : undefined,
        durationSeconds: typeof candidate.duration_seconds === "number" ? candidate.duration_seconds : undefined,
        violations: typeof candidate.violations === "object" && candidate.violations !== null
          ? ((candidate.violations as Record<string, unknown>).total as number | undefined) ?? 0
          : 0,
      });
    } catch (err) {
      removeRun(tempRunId);
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not reach the simulation service");
    } finally {
      setSubmitting(false);
    }
  };

  // ── OpenDSS handler ─────────────────────────────────────────────────────────
  const handleOpenDSSRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!networkId) { toast.error("Please select a network"); return; }
    setOpendssRunState({ phase: "running" });
    try {
      const result = await runOpenDSSSimulation(networkId, opendssDay);
      setOpendssRunState({ phase: "done", result });
      toast.success(`Simulation completed — run ${result.run_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOpendssRunState({ phase: "error", message });
      toast.error(message);
    }
  };

  const isRunning = isOpenDSSNetwork
    ? opendssRunState.phase === "running"
    : submitting;

  return (
    <AppShell>
      <PageHeader
        title="Scenario Builder"
        description="Define a simulation scenario and dispatch it to the SimBench backend."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <form
          onSubmit={isOpenDSSNetwork ? handleOpenDSSRun : handleRun}
          className="lg:col-span-2 space-y-6"
        >
          {/* ── General card (always shown) ──────────────────────────── */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">General</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Scenario name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Network</Label>
                <Select
                  value={networkId}
                  onValueChange={(v) => {
                    setNetworkId(v);
                    setOpendssRunState({ phase: "idle" });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {networks.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name} <span className="text-muted-foreground ml-1">· {n.voltage}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {isOpenDSSNetwork ? (
            /* ── OpenDSS day-picker card ──────────────────────────────── */
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <CalendarDays className="h-4 w-4 text-primary" />
                <div className="text-sm font-semibold">Simulation Day</div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{dateLabel}</span>
                    <Badge variant="secondary" className="text-[10px]">{season}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Day {opendssDay} / 365
                  </span>
                </div>
                <Slider
                  min={1} max={365} step={1}
                  value={[opendssDay]}
                  onValueChange={([v]) => setOpendssDay(v)}
                  disabled={isRunning}
                  className="w-full"
                />
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>Jan</span><span>Apr</span><span>Jul</span><span>Oct</span><span>Dec</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Mode</span>
                <Badge variant="outline" className="capitalize">{opendssMode}</Badge>
              </div>
            </Card>
          ) : (
            /* ── Standard SimBench: Simulation + Horizon cards ────────── */
            <>
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="h-4 w-4 text-primary" />
                  <div className="text-sm font-semibold">Simulation</div>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Simulation type</Label>
                    <div className="rounded-md border border-primary bg-primary/5 p-3">
                      <div className="font-medium text-sm">Time-series</div>
                      <div className="text-xs text-muted-foreground">Profile-driven sweep</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <RadioGroup
                      value={mode}
                      onValueChange={(v) => setMode(v as Mode)}
                      className="grid gap-2"
                    >
                      <Label
                        className={
                          "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors " +
                          (mode === "balanced" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40")
                        }
                      >
                        <RadioGroupItem value="balanced" className="mt-1" />
                        <div>
                          <div className="font-medium text-sm">Balanced</div>
                          <div className="text-xs text-muted-foreground">Symmetric three-phase</div>
                        </div>
                      </Label>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">
                      SimBench networks support balanced simulation .
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <div className="text-sm font-semibold">Simulation horizon</div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Choose the time window the simulation should cover.
                </p>

                <RadioGroup
                  value={horizon}
                  onValueChange={(v) => setHorizon(v as Horizon)}
                  className="grid gap-2 sm:grid-cols-3 mb-6"
                >
                  {([
                    { value: "day",   label: "Day",   desc: "24 h sweep" },
                    { value: "week",  label: "Week",  desc: "7-day window" },
                    { value: "month", label: "Month", desc: "Full month" },
                  ] as const).map((opt) => (
                    <Label
                      key={opt.value}
                      className={
                        "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors " +
                        (horizon === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/40")
                      }
                    >
                      <RadioGroupItem value={opt.value} className="mt-1" />
                      <div>
                        <div className="font-medium text-sm">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>

                <p className="text-xs text-muted-foreground mb-4">
                  Simulations are based on SimBench profiles.
                </p>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      min={2000}
                      max={2100}
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value) || 2016)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Select value={month} onValueChange={(v) => {
                      setMonth(v);
                      const maxDay = new Date(year, Number(v), 0).getDate();
                      if (Number(day) > maxDay) setDay(String(maxDay));
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {horizon !== "month" && (
                    <div className="space-y-2">
                      <Label>{horizon === "week" ? "Start day" : "Day"}</Label>
                      <Select value={day} onValueChange={setDay}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from(
                            { length: new Date(year, Number(month), 0).getDate() },
                            (_, i) => i + 1,
                          ).map((d) => (
                            <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* ── OpenDSS result / error feedback ───────────────────────── */}
          {isOpenDSSNetwork && opendssRunState.phase === "done" && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Completed in {opendssRunState.result.duration_seconds}s</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {([
                  ["Under V", opendssRunState.result.violations.under_voltage],
                  ["Over V",  opendssRunState.result.violations.over_voltage],
                  ["Line",    opendssRunState.result.violations.line_overload],
                  ["Trafo",   opendssRunState.result.violations.trafo_overload],
                ] as [string, number][]).map(([label, val]) => (
                  <div
                    key={label}
                    className={cn(
                      "rounded-lg border px-3 py-2 flex items-center justify-between",
                      val > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/20",
                    )}
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn("font-semibold", val > 0 && "text-destructive")}>{val}</span>
                  </div>
                ))}
              </div>
              <Button asChild variant="outline" size="sm" className="w-full gap-2">
                <Link to="/results" search={{ runId: opendssRunState.result.run_id, networkId }}>
                  <BarChart3 className="h-4 w-4" /> View Results
                </Link>
              </Button>
            </Card>
          )}

          {isOpenDSSNetwork && opendssRunState.phase === "error" && (
            <Card className="p-4">
              <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all">
                  {opendssRunState.message}
                </p>
              </div>
            </Card>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" disabled={isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running simulation…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Simulation
                </>
              )}
            </Button>
          </div>
        </form>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">Summary</div>
            <dl className="space-y-2 text-sm">
              <Row k="Name" v={name} />
              <Row k="Network" v={networks.find((n) => n.id === networkId)?.name ?? "—"} />
              {isOpenDSSNetwork ? (
                <>
                  <Row k="Mode" v={opendssMode ?? "—"} />
                  <Row k="Day" v={`${opendssDay} — ${dateLabel}`} />
                  <Row k="Season" v={season} />
                  {opendssRunState.phase === "done" && (
                    <Row k="Run ID" v={opendssRunState.result.run_id} />
                  )}
                </>
              ) : (
                <>
                  <Row k="Type" v="time-series" />
                  <Row k="Mode" v={mode} />
                  <Row k="Horizon" v={horizon} />
                  {horizon === "month" ? (
                    <Row k="Date" v={`${year}-${String(month).padStart(2, "0")}`} />
                  ) : (
                    <Row
                      k={horizon === "week" ? "Start date" : "Date"}
                      v={`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`}
                    />
                  )}
                  {lastRunId && <Row k="Run ID" v={lastRunId} />}
                </>
              )}
            </dl>
          </Card>

          {!isOpenDSSNetwork && Object.keys(lastResultUrls).length > 0 && (
            <Card className="p-5">
              <div className="text-sm font-semibold mb-3">Latest results</div>
              <ul className="space-y-2 text-sm">
                {(["vm_pu", "line_loading", "trafo_loading"] as const).map((k) =>
                  lastResultUrls[k] ? (
                    <li key={k} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{k}</span>
                      <a
                        href={lastResultUrls[k]}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline truncate max-w-[60%]"
                      >
                        Open
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <div className="text-sm font-semibold mb-3">Recent scenarios</div>
            <div className="space-y-2 text-sm">
              {scenarios.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-border/60 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.simType.replace("_", " ")} · {s.createdBy} · {s.createdAt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-medium text-right capitalize">{v}</dd>
    </div>
  );
}
