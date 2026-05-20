import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, RefreshCw, Zap } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { apiFetch, API_BASE } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/connection-tool-devices")({
  head: () => ({
    meta: [
      { title: "Connection with Tool Devices — DT Lab" },
      { name: "description", content: "Connect external tool devices to your workspace." },
    ],
  }),
  component: ConnectionToolDevicesPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface PiDevice {
  id: string;
  name: string;
  node_id: string | null;
  active: boolean;
  power_p: number | null;
  power_q: number | null;
  last_seen: string | null;
}

interface EdgeNode {
  id: string;
  name: string;
  devices: PiDevice[];
}

interface PolytopeStep {
  t: string;
  vertices: [number, number][];
}

interface FlexibilityResult {
  node_id: string;
  timestamps: string[];
  devices: Record<string, PolytopeStep[]>;
  combined: PolytopeStep[];
  bus_labels: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, unit: string) {
  if (v == null) return "—";
  return `${v.toFixed(2)} ${unit}`;
}

// ── Pi row ────────────────────────────────────────────────────────────────────

function PiRow({ pi }: { pi: PiDevice }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
      <span
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          pi.active ? "bg-green-500" : "bg-muted-foreground/40",
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{pi.name}</div>
        <div className="text-xs text-muted-foreground">{pi.id}</div>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <div className="text-xs tabular-nums">
          <span className="text-muted-foreground">P </span>
          <span className="font-medium">{fmt(pi.power_p, "kW")}</span>
        </div>
        <div className="text-xs tabular-nums">
          <span className="text-muted-foreground">Q </span>
          <span className="font-medium">{fmt(pi.power_q, "kVAR")}</span>
        </div>
      </div>
      <Badge variant={pi.active ? "default" : "secondary"} className="text-xs shrink-0">
        {pi.active ? "Active" : "Offline"}
      </Badge>
    </div>
  );
}

// ── FOR polytope chart ────────────────────────────────────────────────────────

const CHART_COLORS = [
  { stroke: "#1a56db", fill: "#1a56db" },   // Pi #1 — brand blue
  { stroke: "#10b981", fill: "#10b981" },   // Pi #2 — green
  { stroke: "#f59e0b", fill: "#f59e0b" },   // Pi #3 — amber
  { stroke: "#8b5cf6", fill: "#8b5cf6" },   // Pi #4 — purple
];

function PolytopeChart({
  vertices,
  timestamp,
  colorIndex = 0,
}: {
  vertices: [number, number][];
  timestamp: string;
  colorIndex?: number;
}) {
  const { stroke, fill } = CHART_COLORS[colorIndex % CHART_COLORS.length];
  const W = 320, H = 220, PAD = 40;
  // Raw data range (used for ticks)
  const ps = vertices.map(v => v[0]);
  const qs = vertices.map(v => v[1]);
  const rawPMax = Math.max(...ps);
  const rawQMin = Math.min(...qs);
  const rawQMax = Math.max(...qs);
  // P always starts at 0 (loads are positive) — keeps Y-axis at left edge
  const pad = 0.5;
  const pMin = 0;
  const pMax = rawPMax + pad;
  const qMin = rawQMin - pad;
  const qMax = rawQMax + pad;

  const sx = (p: number) => PAD + ((p - pMin) / (pMax - pMin)) * (W - 2 * PAD);
  const sy = (q: number) => H - PAD - ((q - qMin) / (qMax - qMin)) * (H - 2 * PAD);

  const pts = vertices.map(([p, q]) => `${sx(p)},${sy(q)}`).join(" ");
  const ox = sx(0), oy = sy(0); // origin

  // Tick marks — based on raw data range so they never exceed the visible area
  const pTicks = Array.from({ length: Math.floor(rawPMax) + 1 }, (_, i) => i).filter(
    v => v > 0 && v <= Math.floor(rawPMax),
  );
  const qRaw = Math.floor(Math.max(Math.abs(rawQMin), Math.abs(rawQMax)));
  const qTicks = Array.from({ length: qRaw * 2 + 1 }, (_, i) => i - qRaw);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ fontFamily: "inherit", display: "block", width: "100%" }}
    >
      {/* Grid lines */}
      {pTicks.map((p) => (
        <line key={`gp${p}`} x1={sx(p)} y1={PAD} x2={sx(p)} y2={H - PAD}
          stroke="var(--border)" strokeWidth={0.75} strokeDasharray="3 3" />
      ))}
      {qTicks.map((q) => (
        <line key={`gq${q}`} x1={PAD} y1={sy(q)} x2={W - PAD} y2={sy(q)}
          stroke="var(--border)" strokeWidth={0.75} strokeDasharray="3 3" />
      ))}

      {/* Axes */}
      <line x1={PAD} y1={oy} x2={W - PAD} y2={oy} stroke="currentColor" strokeWidth={1.5} />
      <line x1={ox} y1={PAD} x2={ox} y2={H - PAD} stroke="currentColor" strokeWidth={1.5} />

      {/* Axis arrows */}
      <polygon points={`${W - PAD},${oy} ${W - PAD - 8},${oy - 4} ${W - PAD - 8},${oy + 4}`}
        fill="currentColor" />
      <polygon points={`${ox},${PAD} ${ox - 4},${PAD + 8} ${ox + 4},${PAD + 8}`}
        fill="currentColor" />

      {/* Tick labels */}
      {pTicks.filter(p => p > 0).map((p) => (
        <text key={`tp${p}`} x={sx(p)} y={oy + 16} fontSize={10}
          fill="var(--muted-foreground)" textAnchor="middle">{p}</text>
      ))}
      {qTicks.filter(q => q !== 0).map((q) => (
        <text key={`tq${q}`} x={ox - 8} y={sy(q) + 4} fontSize={10}
          fill="var(--muted-foreground)" textAnchor="end">{q}</text>
      ))}

      {/* FOR polygon */}
      {pts && (
        <polygon
          points={pts}
          fill={fill}
          fillOpacity={0.2}
          stroke={stroke}
          strokeWidth={2}
        />
      )}

      {/* Axis labels */}
      <text x={W - PAD - 4} y={oy - 10} fontSize={11} fill="currentColor" fontWeight={500}
        textAnchor="end">
        P (kW)
      </text>
      <text x={ox + 8} y={PAD + 12} fontSize={11} fill="currentColor" fontWeight={500}>
        Q (kVAR)
      </text>

    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ConnectionToolDevicesPage() {
  const [nodes, setNodes] = useState<EdgeNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [estimating, setEstimating] = useState(false);
  const [result, setResult] = useState<FlexibilityResult | null>(null);
  const [topoUrl, setTopoUrl] = useState<string | null>(null);
  const [topoNetwork, setTopoNetwork] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const location = useLocation();
  const isActive = location.pathname === "/connection-tool-devices";

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const allActive = (selectedNode?.devices.length ?? 0) >= 2 && (selectedNode?.devices.every((d) => d.active) ?? false);

  async function fetchNodes() {
    try {
      const res = await apiFetch(`${API_BASE}/edge-nodes`);
      if (res.ok) setNodes(await res.json());
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    if (!isActive) return;
    fetchNodes();
    const id = setInterval(fetchNodes, 15_000);
    return () => clearInterval(id);
  }, [isActive]);

  // Reset everything when node changes
  useEffect(() => {
    setResult(null);
    setStep(0);
    setTopoUrl(null);
    setTopoNetwork(null);
  }, [selectedNodeId]);

  // Fetch topology only once both Pis are active — then keep it even if one goes offline
  useEffect(() => {
    if (!allActive || !selectedNodeId || topoUrl) return;
    apiFetch(`${API_BASE}/edge-nodes/${selectedNodeId}/topology`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.url) setTopoUrl(`${API_BASE}${data.url}`);
        if (data?.network) setTopoNetwork(data.network);
      })
      .catch(() => {});
  }, [allActive, selectedNodeId]);

  // Reset slider when new result arrives
  useEffect(() => {
    setStep(0);
  }, [result]);

  async function handleEstimate() {
    if (!selectedNodeId) return;
    setEstimating(true);
    setResult(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/edge-nodes/${selectedNodeId}/flexibility`,
        { method: "POST" },
      );
      if (res.ok) setResult(await res.json());
    } catch {
      // error handled silently; user can retry
    } finally {
      setEstimating(false);
    }
  }

  const currentCombined = result?.combined[step] ?? null;
  const deviceNames = result ? Object.keys(result.devices) : [];

  return (
    <AppShell>
      <PageHeader
        title="Connection with Edge devices"
        description="Monitor edge nodes and estimate flexibility potential."
      />

      <Card className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Edge Nodes</div>
            <div className="text-xs text-muted-foreground">
              Select a node to view its Raspberry Pi devices and estimate flexibility
            </div>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:items-start">
          {/* ── Left panel ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Node selector */}
            <div className="space-y-2">
              <Label>Select Edge Node</Label>
              <div className="flex gap-2">
                <Select value={selectedNodeId} onValueChange={setSelectedNodeId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue
                      placeholder={
                        nodes.length === 0 ? "No nodes registered" : "Choose a node…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {nodes.map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={fetchNodes}
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Pi list */}
            {selectedNode && selectedNode.devices.length > 0 && (
              <div className="space-y-2">
                <Label>Raspberry Pi Devices</Label>
                <div className="space-y-2">
                  {selectedNode.devices.map((pi) => (
                    <PiRow key={pi.id} pi={pi} />
                  ))}
                </div>
              </div>
            )}

            {selectedNode && selectedNode.devices.length === 0 && (
              <p className="text-xs text-muted-foreground border border-dashed rounded-md p-3">
                No devices registered in this node yet.
              </p>
            )}

            {!selectedNodeId && nodes.length === 0 && (
              <p className="text-xs text-muted-foreground border border-dashed rounded-md p-3">
                No nodes yet. Run <code className="font-mono">agent.py</code> with{" "}
                <code className="font-mono">--node</code> to register one.
              </p>
            )}

            {/* Estimate button */}
            {selectedNode && (
              <Button
                className="w-full"
                disabled={!allActive || estimating}
                onClick={handleEstimate}
              >
                <Zap className="h-4 w-4 mr-2" />
                {estimating ? "Estimating…" : "Estimate Flexibility Potential"}
              </Button>
            )}

            {selectedNode && !allActive && (
              <p className="text-xs text-muted-foreground text-center">
                All devices must be active to enable estimation.
              </p>
            )}
          </div>

          {/* ── Right panel ───────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* ── Topology ── */}
            {selectedNode && (allActive || topoUrl) && (
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Network Topology
                  </p>
                  {topoNetwork && (
                    <span className="text-xs font-mono text-muted-foreground truncate">{topoNetwork}</span>
                  )}
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  {topoUrl ? (
                    <iframe
                      src={topoUrl}
                      className="w-full h-[260px] block"
                      title="Network Topology"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground bg-muted/20">
                      Loading topology…
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── FOR ── */}
            {result && currentCombined ? (
              <div className="space-y-4">
                {/* Title + timestamp */}
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex-1">
                    Flexibility Operating Region (FOR)
                  </p>
                  <Badge variant="outline" className="tabular-nums font-mono text-xs">
                    t = {currentCombined.t}
                  </Badge>
                </div>

                {/* Description */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each polygon shows the set of all feasible{" "}
                  <span className="font-medium text-foreground">active (P)</span> and{" "}
                  <span className="font-medium text-foreground">reactive (Q)</span> power
                  operating points that the device can deliver at the selected minute.
                  Drag the slider to explore how the region evolves over the 15-minute horizon.
                </p>

                {/* Individual Pi charts side by side */}
                <div className="grid grid-cols-2 gap-3">
                  {deviceNames.map((name, i) => (
                    <div key={name} className="rounded-xl border border-border bg-muted/10 p-3 space-y-2">
                      {/* Chart header with color swatch */}
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length].fill }}
                        />
                        <span className="text-xs font-semibold">
                          {result.bus_labels?.[name] ? `${result.bus_labels[name]} — ${name}` : name}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                          P<sub>c</sub> ≈ {result.devices[name][step]?.vertices
                            ? (result.devices[name][step].vertices.reduce((s, v) => s + v[0], 0) / result.devices[name][step].vertices.length).toFixed(1)
                            : "—"} kW
                        </span>
                      </div>
                      <div className="overflow-hidden">
                        <PolytopeChart
                          vertices={result.devices[name][step]?.vertices ?? []}
                          timestamp={result.devices[name][step]?.t ?? ""}
                          colorIndex={i}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Shared slider */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={result.timestamps.length - 1}
                    value={step}
                    onChange={(e) => setStep(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>{result.timestamps[0]}</span>
                    <span className="text-foreground font-medium">{currentCombined.t}</span>
                    <span>{result.timestamps.at(-1)}</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="rounded-lg border border-border bg-muted/10 px-4 py-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  {deviceNames.map((name, i) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <span
                        className="h-3 w-3 rounded-sm border shrink-0"
                        style={{
                          background: CHART_COLORS[i % CHART_COLORS.length].fill + "33",
                          borderColor: CHART_COLORS[i % CHART_COLORS.length].stroke,
                        }}
                      />
                      <span>{result.bus_labels?.[name] ?? name} — FOR boundary</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">P</span>
                    <span>Active power (kW) — horizontal axis</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">Q</span>
                    <span>Reactive power (kVAR) — vertical axis</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 min-h-[200px]">
                <p className="text-sm text-muted-foreground text-center px-6">
                  {selectedNode
                    ? allActive
                      ? "Press \"Estimate Flexibility Potential\" to see results."
                      : "All devices must be active to run the estimation."
                    : "Select an Edge Node to get started."}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
