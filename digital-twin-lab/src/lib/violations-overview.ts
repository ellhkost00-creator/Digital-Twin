import { fetchResultCsv, type ParsedCsv } from "@/lib/results-data";

export const V_LOWER = 0.94;
export const V_UPPER = 1.06;
export const LOAD_LIMIT = 100;

export interface NetworkViolationStats {
  networkId: string;
  /** Total numeric cells per kind. */
  vmTotal: number;
  underCount: number;
  overCount: number;
  lineTotal: number;
  lineOverCount: number;
  trafoTotal: number;
  trafoOverCount: number;
  hasResults: boolean;
  hasAnyViolation: boolean;
}

export interface SystemViolationOverview {
  perNetwork: NetworkViolationStats[];
  networksWithResults: number;
  networksWithViolations: number;
  totalNetworks: number;
  underPct: number;
  overPct: number;
  linePct: number;
  trafoPct: number;
}

function countCells(parsed: ParsedCsv, predicate: (v: number) => boolean) {
  let total = 0;
  let hits = 0;
  for (const row of parsed.rows) {
    for (const v of row) {
      if (!Number.isFinite(v)) continue;
      total++;
      if (predicate(v)) hits++;
    }
  }
  return { total, hits };
}

async function safeFetch(
  networkId: string,
  runId: string,
  kind: "vm-pu" | "line-loading" | "trafo-loading",
): Promise<ParsedCsv | null> {
  try {
    return await fetchResultCsv(networkId, runId, kind);
  } catch {
    return null;
  }
}

export async function computeNetworkStats(
  networkId: string,
  runId: string,
): Promise<NetworkViolationStats> {
  const [vm, line, trafo] = await Promise.all([
    safeFetch(networkId, runId, "vm-pu"),
    safeFetch(networkId, runId, "line-loading"),
    safeFetch(networkId, runId, "trafo-loading"),
  ]);

  const vmCounts = vm
    ? {
        total: countCells(vm, () => true).total,
        under: countCells(vm, (v) => v < V_LOWER).hits,
        over: countCells(vm, (v) => v > V_UPPER).hits,
      }
    : { total: 0, under: 0, over: 0 };

  const lineCounts = line
    ? {
        total: countCells(line, () => true).total,
        over: countCells(line, (v) => v > LOAD_LIMIT).hits,
      }
    : { total: 0, over: 0 };

  const trafoCounts = trafo
    ? {
        total: countCells(trafo, () => true).total,
        over: countCells(trafo, (v) => v > LOAD_LIMIT).hits,
      }
    : { total: 0, over: 0 };

  const hasResults = Boolean(vm || line || trafo);
  const hasAnyViolation =
    vmCounts.under > 0 ||
    vmCounts.over > 0 ||
    lineCounts.over > 0 ||
    trafoCounts.over > 0;

  return {
    networkId,
    vmTotal: vmCounts.total,
    underCount: vmCounts.under,
    overCount: vmCounts.over,
    lineTotal: lineCounts.total,
    lineOverCount: lineCounts.over,
    trafoTotal: trafoCounts.total,
    trafoOverCount: trafoCounts.over,
    hasResults,
    hasAnyViolation,
  };
}

/** Pick the latest run per networkId based on lexicographic runId (timestamp suffix sorts correctly). */
export function pickLatestRunPerNetwork(
  runs: { id: string; networkId?: string; status: string }[],
): { networkId: string; runId: string }[] {
  const latest = new Map<string, string>();
  for (const r of runs) {
    if (r.status !== "completed" || !r.networkId) continue;
    const cur = latest.get(r.networkId);
    if (!cur || r.id > cur) latest.set(r.networkId, r.id);
  }
  return Array.from(latest, ([networkId, runId]) => ({ networkId, runId }));
}

export async function computeSystemOverview(
  runs: { id: string; networkId?: string; status: string }[],
  totalNetworks: number,
): Promise<SystemViolationOverview> {
  const latest = pickLatestRunPerNetwork(runs);
  const perNetwork = await Promise.all(
    latest.map((l) => computeNetworkStats(l.networkId, l.runId)),
  );

  const sum = (sel: (s: NetworkViolationStats) => number) =>
    perNetwork.reduce((acc, s) => acc + sel(s), 0);

  const vmTotal = sum((s) => s.vmTotal);
  const lineTotal = sum((s) => s.lineTotal);
  const trafoTotal = sum((s) => s.trafoTotal);

  const pct = (num: number, den: number) =>
    den > 0 ? (num / den) * 100 : 0;

  return {
    perNetwork,
    networksWithResults: perNetwork.filter((s) => s.hasResults).length,
    networksWithViolations: perNetwork.filter((s) => s.hasAnyViolation).length,
    totalNetworks,
    underPct: pct(sum((s) => s.underCount), vmTotal),
    overPct: pct(sum((s) => s.overCount), vmTotal),
    linePct: pct(sum((s) => s.lineOverCount), lineTotal),
    trafoPct: pct(sum((s) => s.trafoOverCount), trafoTotal),
  };
}
