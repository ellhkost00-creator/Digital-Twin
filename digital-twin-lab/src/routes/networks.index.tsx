import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { useNetworks, seedNetworks } from "@/lib/networks-store";
import { fetchSimbenchNetworks } from "@/lib/api";
import { Upload, Search, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/networks/")({
  head: () => ({
    meta: [
      { title: "Network Library — DT Lab" },
      { name: "description", content: "SimBench distribution network models loaded from the SimBench service." },
    ],
  }),
  loader: () => fetchSimbenchNetworks(),
  errorComponent: ({ error }) => {
    const router = useRouter();
    return (
      <AppShell>
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1">
              <div className="font-medium">Failed to load networks</div>
              <div className="text-sm text-muted-foreground mt-1">{error.message}</div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => router.invalidate()}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Retry
              </Button>
            </div>
          </div>
        </Card>
      </AppShell>
    );
  },
  notFoundComponent: () => (
    <AppShell>
      <Card className="p-6 text-sm text-muted-foreground">Network Library not found.</Card>
    </AppShell>
  ),
  component: NetworkLibrary,
});

function NetworkLibrary() {
  const loaderData = Route.useLoaderData();
  const router = useRouter();

  // Seed the in-memory store so other pages (detail, dashboard, comparison)
  // can read from `networks` synchronously.
  useEffect(() => {
    seedNetworks(loaderData.networks);
  }, [loaderData.networks]);

  const storeNetworks = useNetworks();
  const networks = storeNetworks.length > 0 ? storeNetworks : loaderData.networks;
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const filtered = networks.filter(
    (n) =>
      (type === "all" || n.type === type) &&
      (status === "all" || n.status === status) &&
      (q === "" || n.name.toLowerCase().includes(q.toLowerCase())),
  );

  const isEmpty = networks.length === 0;
  const serviceError = loaderData.error;

  return (
    <AppShell>
      <PageHeader
        title="Network Library"
        description="Catalog of SimBench distribution network models. Click a network for asset details."
        actions={
          <Button variant="outline" onClick={() => router.invalidate()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        }
      />

      {isEmpty && (
        <Card className="p-6 mb-6">
          <div className="flex items-start gap-3">
            {serviceError ? (
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-medium">
                {serviceError ? "Couldn't reach SimBench service" : "No networks loaded yet"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {serviceError
                  ? serviceError
                  : "Configure SIMBENCH_SERVICE_URL in project secrets and point it at your Python service to load real SimBench LV networks."}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full md:w-40"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="LV">LV</SelectItem>
              <SelectItem value="MV">MV</SelectItem>
              <SelectItem value="HV">HV</SelectItem>
              <SelectItem value="Mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="validated">Validated</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4 font-medium">Name</th>
                <th className="py-3 px-4 font-medium">Voltage</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Created</th>
                <th className="py-3 px-4 font-medium">Version</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Assets</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => (
                <tr key={n.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4 font-medium">
                    <Link to="/networks/$networkId" params={{ networkId: n.id }} className="hover:text-primary">
                      {n.name}
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono">{n.id}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">{n.voltage}</td>
                  <td className="py-3 px-4">{n.type}</td>
                  <td className="py-3 px-4 text-muted-foreground">{n.created}</td>
                  <td className="py-3 px-4 font-mono text-xs">{n.version}</td>
                  <td className="py-3 px-4"><StatusBadge status={n.status} /></td>
                  <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                    {n.buses}b · {n.lines}l · {n.transformers}t
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      to="/networks/$networkId"
                      params={{ networkId: n.id }}
                      className="text-muted-foreground hover:text-primary inline-flex"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !isEmpty && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    No networks match your filters.
                  </td>
                </tr>
              )}
              {isEmpty && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    No networks loaded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
