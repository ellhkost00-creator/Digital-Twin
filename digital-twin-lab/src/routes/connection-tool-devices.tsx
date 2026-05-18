import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Cable, RefreshCw } from "lucide-react";
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
      {
        name: "description",
        content: "Connect external tool devices to your workspace.",
      },
      {
        property: "og:title",
        content: "Connection with Tool Devices — DT Lab",
      },
      {
        property: "og:description",
        content: "Connect external tool devices to your workspace.",
      },
    ],
  }),
  component: ConnectionToolDevicesPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface EdgeDevice {
  id: string;
  name: string;
  status: "online" | "offline";
  last_seen: string | null;
  registered_at: string | null;
  extra: Record<string, unknown> | null;
}

interface TelemetrySnapshot {
  ts: string;
  readings: Record<string, number>;
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 80, H = 28, pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((v - min) / range) * (H - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={W} height={H} className="opacity-70">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── MetricCard ────────────────────────────────────────────────────────────────

function MetricCard({ label, history }: { label: string; history: number[] }) {
  const latest = history.at(-1);
  const display = latest !== undefined
    ? (Number.isInteger(latest) ? latest : latest.toFixed(2))
    : "—";

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-1">
      <div className="text-xs text-muted-foreground truncate">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{display}</div>
      <Sparkline values={history.slice(-20)} />
    </div>
  );
}

// ── Edge Devices Section ──────────────────────────────────────────────────────

type WsStatus = "idle" | "connecting" | "live" | "disconnected";

function EdgeDevicesCard() {
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [wsStatus, setWsStatus] = useState<WsStatus>("idle");
  const [metrics, setMetrics] = useState<Record<string, number[]>>({});
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Fetch device list ────────────────────────────────────────────────────
  async function fetchDevices() {
    try {
      const res = await apiFetch(`${API_BASE}/devices`);
      if (res.ok) {
        const data: EdgeDevice[] = await res.json();
        setDevices(data);
      }
    } catch {
      // silently ignore network errors
    }
  }

  useEffect(() => {
    fetchDevices();
    const id = setInterval(fetchDevices, 15_000);
    return () => clearInterval(id);
  }, []);

  // ── Load history + open WebSocket when device is selected ────────────────
  useEffect(() => {
    // Close previous connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setMetrics({});
    setLastSeen(null);

    if (!selectedId) {
      setWsStatus("idle");
      return;
    }

    // Preload history
    apiFetch(`${API_BASE}/devices/${selectedId}/telemetry?limit=60`)
      .then((r) => r.ok ? r.json() : [])
      .then((rows: TelemetrySnapshot[]) => {
        const acc: Record<string, number[]> = {};
        for (const row of rows) {
          for (const [k, v] of Object.entries(row.readings)) {
            if (!acc[k]) acc[k] = [];
            acc[k].push(v);
          }
        }
        setMetrics(acc);
        if (rows.length) setLastSeen(rows.at(-1)!.ts);
      })
      .catch(() => {});

    // Open WebSocket
    setWsStatus("connecting");
    const wsUrl = API_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsUrl}/devices/${selectedId}/stream`);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus("live");
    ws.onclose = () => setWsStatus("disconnected");
    ws.onerror = () => setWsStatus("disconnected");
    ws.onmessage = (evt) => {
      try {
        const snapshot: TelemetrySnapshot & { ping?: boolean } = JSON.parse(evt.data);
        if (snapshot.ping) return;
        setLastSeen(snapshot.ts);
        setMetrics((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(snapshot.readings)) {
            next[k] = [...(prev[k] ?? []).slice(-99), v];
          }
          return next;
        });
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedId]);

  const statusBadge: Record<WsStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    idle:         { label: "No device",    variant: "outline" },
    connecting:   { label: "Connecting…",  variant: "secondary" },
    live:         { label: "Live",         variant: "default" },
    disconnected: { label: "Disconnected", variant: "destructive" },
  };
  const badge = statusBadge[wsStatus];
  const metricKeys = Object.keys(metrics);

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Cable className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">Edge Devices</div>
          <div className="text-xs text-muted-foreground">Live telemetry from Raspberry Pi, PLCs &amp; sensors</div>
        </div>
      </div>

      <Separator className="my-5" />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
        {/* Left: device selector */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select device</Label>
            <div className="flex gap-2">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={devices.length === 0 ? "No devices registered" : "Choose a device…"} />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-block h-2 w-2 rounded-full",
                            d.status === "online" ? "bg-green-500" : "bg-muted-foreground",
                          )}
                        />
                        {d.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" variant="outline" onClick={fetchDevices} title="Refresh device list">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedId && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Stream:</span>
                <Badge variant={badge.variant} className="text-xs py-0">{badge.label}</Badge>
              </div>
              {lastSeen && (
                <div>Last reading: {new Date(lastSeen).toLocaleTimeString()}</div>
              )}
            </div>
          )}

          {devices.length === 0 && (
            <p className="text-xs text-muted-foreground border border-dashed rounded-md p-3">
              No devices yet. Run <code className="font-mono">agent.py</code> on your Pi to register it.
            </p>
          )}
        </div>

        {/* Right: live metric cards */}
        {metricKeys.length > 0 ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
            {metricKeys.map((key) => (
              <MetricCard key={key} label={key} history={metrics[key]} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 min-h-[160px]">
            <p className="text-sm text-muted-foreground text-center px-6">
              {selectedId
                ? wsStatus === "connecting"
                  ? "Connecting to device…"
                  : "Waiting for telemetry…"
                : "Select a device to view live data."}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function ConnectionToolDevicesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Connection with Tool Devices"
        description="Manage connections between DT Lab and external hardware/software tools."
      />
      <EdgeDevicesCard />
    </AppShell>
  );
}
