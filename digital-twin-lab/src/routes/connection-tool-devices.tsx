import { createFileRoute } from "@tanstack/react-router";
import { Cable, Hammer } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";

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

function ConnectionToolDevicesPage() {
  return (
    <AppShell>
      <PageHeader
        title="Connection with Tool Devices"
        description="Manage connections between DT Lab and external hardware/software tools."
      />
      <Card className="p-12 text-center border-dashed">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Hammer className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold mb-1 flex items-center justify-center gap-2">
          <Cable className="h-4 w-4 text-muted-foreground" />
          In progress
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This section is currently under development. Check back soon for tool
          device connection features.
        </p>
      </Card>
    </AppShell>
  );
}
