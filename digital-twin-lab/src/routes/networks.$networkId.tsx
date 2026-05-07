import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, StatusBadge } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Network } from "@/lib/mock-data";
import { fetchSimbenchNetworks } from "@/lib/api";
import { ArrowLeft, Cable, Zap, Box, Plug, Download, Play } from "lucide-react";
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

        </div>
      </div>
    </AppShell>
  );
}
