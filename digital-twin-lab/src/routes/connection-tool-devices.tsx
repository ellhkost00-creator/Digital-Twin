import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Cable, Hammer, Wifi, Zap } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useNetworks } from "@/lib/networks-store";
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

// ── Page ─────────────────────────────────────────────────────────────────────
function ConnectionToolDevicesPage() {
  const networks = useNetworks();

  const [topologyId, setTopologyId]         = useState<string>("");
  const [connectionType, setConnectionType] = useState<"edge" | "real">("real");
  const [hour, setHour]                     = useState<string>("12");

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  function handleEstimate() {
    if (!topologyId) { toast.error("Please select a topology"); return; }
    toast.info("Flexibility estimation — backend not yet connected.");
  }

  return (
    <AppShell>
      <PageHeader
        title="Connection with Tool Devices"
        description="Manage connections between DT Lab and external hardware/software tools."
      />

      {/* ── Existing placeholder card ────────────────────────────────────── */}


      {/* ── APEL Live Demonstration ──────────────────────────────────────── */}
      <Card className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wifi className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">APEL Live Demonstration</div>
            <div className="text-xs text-muted-foreground">Connection to Real Devices</div>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-start">
          {/* ── Left: form ──────────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Topology */}
            <div className="space-y-2">
              <Label>Topology</Label>
              <Select value={topologyId} onValueChange={setTopologyId}>
                <SelectTrigger>
                  <SelectValue placeholder={networks.length === 0 ? "No networks available" : "Select a topology…"} />
                </SelectTrigger>
                <SelectContent>
                  {networks.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Connection type */}
            <div className="space-y-2">
              <Label>Connection type</Label>
              <RadioGroup
                value={connectionType}
                onValueChange={(v) => setConnectionType(v as "edge" | "real")}
                className="grid gap-2"
              >
                {(
                  [
                    { value: "real" as const, label: "Real Devices",  desc: "Directly controllable physical devices" },
                    { value: "edge" as const, label: "Edge Devices",  desc: "IoT / telemetry-connected edge nodes" },
                  ] as const
                ).map((opt) => (
                  <Label
                    key={opt.value}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3 cursor-pointer transition-colors",
                      connectionType === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5 hidden" />
                    <div>
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.desc}</div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            </div>

            {/* Hour */}
            <div className="space-y-2">
              <Label>Hour of day</Label>
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <Button className="w-full" onClick={handleEstimate}>
              <Zap className="h-4 w-4 mr-2" />
              Estimate Flexibility
            </Button>
          </div>

          {/* ── Right: results placeholder ──────────────────────────────── */}
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 min-h-[260px]">
            <p className="text-sm text-muted-foreground text-center px-6">
              Results will appear here once the backend is connected.
            </p>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
