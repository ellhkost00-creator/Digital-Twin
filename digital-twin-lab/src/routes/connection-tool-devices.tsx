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
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

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

interface FlexibilityResult {
  node_id: string;
  timestamps: string[];
  p_flexibility: Record<string, number[]>;
  q_flexibility: Record<string, number[]>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, unit: string) {
  if (v == null) return "—";
  return `${v.toFixed(2)} ${unit}`;
}

function toChartData(timestamps: string[], series: Record<string, number[]>) {
  return timestamps.map((t, i) => ({
    t,
    ...Object.fromEntries(Object.entries(series).map(([k, v]) => [k, v[i]])),
  }));
}

const LINE_COLORS = [
  "var(--primary)",
  "oklch(0.6 0.2 250)",
  "oklch(0.6 0.2 140)",
  "oklch(0.6 0.2 30)",
];

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

// ── Flexibility chart ─────────────────────────────────────────────────────────

function FlexChart({
  title,
  unit,
  data,
  keys,
}: {
  title: string;
  unit: string;
  data: ReturnType<typeof toChartData>;
  keys: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold">{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="t" tick={{ fontSize: 11 }} />
          <YAxis unit={` ${unit}`} tick={{ fontSize: 11 }} width={52} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(3)} ${unit}`]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {keys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ConnectionToolDevicesPage() {
  const [nodes, setNodes] = useState<EdgeNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [estimating, setEstimating] = useState(false);
  const [result, setResult] = useState<FlexibilityResult | null>(null);
  const [topoUrl, setTopoUrl] = useState<string | null>(null);

  const location = useLocation();
  const isActive = location.pathname === "/connection-tool-devices";

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const allActive = (selectedNode?.devices.length ?? 0) > 0 && (selectedNode?.devices.every((d) => d.active) ?? false);

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

  // Reset result and topology when node changes
  useEffect(() => {
    setResult(null);
    setTopoUrl(null);
    if (!selectedNodeId) return;
    apiFetch(`${API_BASE}/edge-nodes/${selectedNodeId}/topology`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.url) setTopoUrl(`${API_BASE}${data.url}`); })
      .catch(() => {});
  }, [selectedNodeId]);

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

  const pData = result
    ? toChartData(result.timestamps, result.p_flexibility)
    : null;
  const qData = result
    ? toChartData(result.timestamps, result.q_flexibility)
    : null;

  return (
    <AppShell>
      <PageHeader
        title="Connection with Tool Devices"
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

          {/* ── Right panel: topology + charts ───────────────────────── */}
          <div className="space-y-6">
            {/* Topology overview */}
            {selectedNode && (
              <div className="rounded-lg border border-border overflow-hidden bg-muted/20">
                {topoUrl ? (
                  <iframe
                    src={topoUrl}
                    className="w-full h-[300px] block"
                    title="Network Topology"
                  />
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                    Loading topology…
                  </div>
                )}
              </div>
            )}

            {selectedNode && <Separator />}

            {/* Flexibility charts */}
            {pData && qData && result ? (
              <div className="space-y-8">
                <FlexChart title="P Flexibility Potential" unit="kW" data={pData} keys={Object.keys(result.p_flexibility)} />
                <FlexChart title="Q Flexibility Potential" unit="kVAR" data={qData} keys={Object.keys(result.q_flexibility)} />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 min-h-[260px]">
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
