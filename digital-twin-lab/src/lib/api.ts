import type { Network } from "@/lib/mock-data";

export const API_BASE = "http://localhost:8000";

export type Horizon = "day" | "week" | "month";

export async function fetchSimbenchNetworks(): Promise<{
  networks: Network[];
  serviceUrl: string;
  error: string | null;
}> {
  const response = await fetch(`${API_BASE}/networks`);
  if (!response.ok) throw new Error("Failed to fetch networks");
  const networks = (await response.json()) as Network[];
  return { networks, serviceUrl: API_BASE, error: null };
}

export interface RunSimulationParams {
  networkId: string;
  horizon: Horizon;
  year: number;
  month: number;
  day?: number;
}

export async function runSimulation(params: RunSimulationParams) {
  const { networkId, horizon, year, month, day } = params;

  const body: Record<string, unknown> = {
    horizon,
    year,
    month,
    mode: "balanced",
  };
  if (horizon === "day" || horizon === "week") {
    body.day = day;
  }

  const response = await fetch(`${API_BASE}/networks/${networkId}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let msg = `Simulation failed (${response.status})`;
    try {
      const errJson = await response.json();
      msg =
        (errJson && (errJson.detail || errJson.message || errJson.error)) ||
        JSON.stringify(errJson);
    } catch {
      try {
        const txt = await response.text();
        if (txt) msg = txt;
      } catch {}
    }
    throw new Error(msg);
  }

  return response.json();
}

export type ResultKind = "vm-pu" | "line-loading" | "trafo-loading";

export function buildResultUrl(networkId: string, runId: string, kind: ResultKind) {
  return `${API_BASE}/networks/${networkId}/results/${runId}/${kind}`;
}

export async function fetchResult(networkId: string, runId: string, kind: ResultKind) {
  const url = buildResultUrl(networkId, runId, kind);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${kind}`);
  return response.json();
}

export interface EnvelopeResult {
  min: number[];
  mean: number[];
  max: number[];
  columns: string[];
  n_rows: number;
}

export async function fetchResultEnvelope(
  networkId: string,
  runId: string,
  kind: ResultKind,
): Promise<EnvelopeResult> {
  const url = `${API_BASE}/networks/${networkId}/results/${runId}/${kind}/envelope`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${kind} (${res.status})`);
  return res.json();
}

export async function fetchResultColumn(
  networkId: string,
  runId: string,
  kind: ResultKind,
  colName: string,
): Promise<{ column: string; values: number[] }> {
  const url = `${API_BASE}/networks/${networkId}/results/${runId}/${kind}/column/${encodeURIComponent(colName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load column (${res.status})`);
  return res.json();
}

export interface BackendRun {
  network_id: string;
  run_id: string;
  started_at: string | null;
  duration_seconds: number | null;
  violations: {
    under_voltage: number | null;
    over_voltage: number | null;
    line_overload: number | null;
    trafo_overload: number | null;
    total: number | null;
  } | null;
  results: {
    vm_pu: string;
    line_loading: string;
    trafo_loading: string | null;
  };
}

export interface OpenDSSRunResult {
  status: "completed";
  network_id: string;
  run_id: string;
  day: number;
  mode: string;
  started_at: string;
  duration_seconds: number;
  violations: {
    under_voltage: number;
    over_voltage: number;
    line_overload: number;
    trafo_overload: number;
    total: number;
  };
  results: {
    vm_pu: string;
    line_loading: string;
    trafo_loading: string | null;
  };
}

export async function runOpenDSSSimulation(
  networkId: string,
  day: number,
): Promise<OpenDSSRunResult> {
  const response = await fetch(`${API_BASE}/networks/${networkId}/run-opendss`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ day }),
  });

  if (!response.ok) {
    let msg = `Simulation failed (${response.status})`;
    try {
      const err = await response.json();
      msg = err.detail || err.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return response.json();
}

export async function fetchRuns(): Promise<BackendRun[]> {
  const response = await fetch(`${API_BASE}/runs`);
  if (!response.ok) throw new Error("Failed to fetch runs");
  return response.json();
}

export interface ConvertOpenDSSResult {
  status: "completed";
  network: string;
  network_name: string;
  mode: "balanced" | "unbalanced";
  duration_seconds: number;
  network_stats: {
    buses: number;
    lines: number;
    transformers: number;
    loads: number;
  };
  cached: boolean;
  plot_url: string | null;
  plot_height: number | null;
}

export interface ValidationBusEntry {
  bus_name: string;
  phase?: string;
  mape: number | null;
  max: number | null;
  bias: number | null;
}

export interface ValidationPhase {
  matched: number;
  mape: number | null;
  max?: number | null;
  max_ae?: number | null;
  rmse?: number | null;
  bias?: number | null;
  mae?: number | null;
  mbe?: number | null;
}

export interface ValidationLoadingEntry {
  dss_name: string;
  phase: string;
  mae: number | null;
  rmse: number | null;
  max_ae: number | null;
  mbe: number | null;
}

export interface ValidationBusVoltage {
  matched: number | null;
  total_points: number | null;
  mape: number | null;
  max_error: number | null;
  bias: number | null;
  by_phase: Record<string, ValidationPhase>;
  worst_buses: ValidationBusEntry[];
}

export interface ValidationLoading {
  matched_elements: number;
  mae: number | null;
  rmse: number | null;
  max_ae: number | null;
  mbe: number | null;
  by_phase: Record<string, ValidationPhase>;
  worst: ValidationLoadingEntry[];
}

export interface SimulationValidation {
  bus_voltage: ValidationBusVoltage;
  mv_line_loading?: ValidationLoading;
  lv_line_loading?: ValidationLoading;
  trafo_loading?: ValidationLoading;
}

export interface SimulateOpenDSSResult {
  status: "completed";
  network: string;
  network_name: string;
  mode: "balanced" | "unbalanced";
  day: number;
  duration_seconds: number;
  metrics: Record<string, number | string>;
  validation?: SimulationValidation;
  validation_hours?: number;
  n_timesteps?: number;
  validation_start?: string;
  validation_end?: string;
}

export async function simulateOpenDSS(
  network: "1" | "2" | "3" | "4",
  mode: "balanced" | "unbalanced",
  day: number,
  validationHours: 1 | 2 | 4 | 24 = 2,
): Promise<SimulateOpenDSSResult> {
  const response = await fetch(`${API_BASE}/convert/opendss/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ network, mode, day, validation_hours: validationHours }),
  });

  if (!response.ok) {
    let msg = `Simulation failed (${response.status})`;
    try {
      const err = await response.json();
      msg = err.detail || err.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return response.json();
}

export interface SaveOpenDSSResult {
  status: "saved";
  network_id: string;
  network: Record<string, unknown>;
}

export async function saveOpenDSSNetwork(
  network: "1" | "2" | "3" | "4",
  mode: "balanced" | "unbalanced",
  validation_day?: number,
  metrics?: Record<string, number | string>,
): Promise<SaveOpenDSSResult> {
  const response = await fetch(`${API_BASE}/convert/opendss/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ network, mode, validation_day, metrics }),
  });

  if (!response.ok) {
    let msg = `Save failed (${response.status})`;
    try {
      const err = await response.json();
      msg = err.detail || err.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return response.json();
}

export async function convertOpenDSS(
  network: "1" | "2" | "3" | "4",
  mode: "balanced" | "unbalanced",
): Promise<ConvertOpenDSSResult> {
  const response = await fetch(`${API_BASE}/convert/opendss`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ network, mode }),
  });

  if (!response.ok) {
    let msg = `Conversion failed (${response.status})`;
    try {
      const err = await response.json();
      msg = err.detail || err.message || msg;
    } catch {}
    throw new Error(msg);
  }

  return response.json();
}

// ── Scenarios ────────────────────────────────────────────────────────────────

export interface ScenarioApi {
  id: string;
  name: string;
  networkId: string;
  simType: string;
  mode: string;
  horizon: string;
  timestep: string;
  createdBy: string;
  createdAt: string;
}

export async function fetchScenarios(): Promise<ScenarioApi[]> {
  const res = await fetch(`${API_BASE}/scenarios`);
  if (!res.ok) throw new Error(`Failed to fetch scenarios (${res.status})`);
  return res.json();
}

export async function createScenarioApi(input: {
  id: string;
  name: string;
  networkId: string;
  simType: string;
  mode: string;
  horizon: string;
  timestep: string;
  createdBy: string;
}): Promise<ScenarioApi> {
  const res = await fetch(`${API_BASE}/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: input.id,
      name: input.name,
      network_id: input.networkId,
      sim_type: input.simType,
      mode: input.mode,
      horizon: input.horizon,
      timestep: input.timestep,
      created_by: input.createdBy,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create scenario (${res.status})`);
  return res.json();
}

export async function deleteScenarioApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/scenarios/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to delete scenario (${res.status})`);
}

// ── Users ────────────────────────────────────────────────────────────────────

export interface ManagedUserApi {
  id: string;
  name: string;
  email: string;
  role: "admin" | "researcher" | "student";
  initials: string;
  isSelf?: boolean;
}

export async function fetchUsers(): Promise<ManagedUserApi[]> {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error(`Failed to fetch users (${res.status})`);
  return res.json();
}

export async function createUserApi(input: {
  name: string;
  email: string;
  role: string;
}): Promise<ManagedUserApi[]> {
  const res = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create user (${res.status})`);
  return res.json();
}

export async function updateUserRoleApi(id: string, role: string): Promise<ManagedUserApi[]> {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`Failed to update user role (${res.status})`);
  return res.json();
}

export async function deleteUserApi(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to delete user (${res.status})`);
}

export async function fetchRunValidation(runId: string): Promise<SimulationValidation | null> {
  const res = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/validation`);
  if (!res.ok) return null;
  return res.json();
}

// ── Phase data for unbalanced networks ───────────────────────────────────────

export interface PhaseData {
  mean: number[];
  max: number[];
  min: number[];
  n_rows: number;
}

export interface PhasesResult {
  a: PhaseData;
  b: PhaseData;
  c: PhaseData;
}

export async function fetchResultPhases(
  networkId: string,
  runId: string,
  kind: ResultKind,
): Promise<PhasesResult> {
  const url = `${API_BASE}/networks/${networkId}/results/${runId}/${kind}/phases`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${kind} phases (${res.status})`);
  return res.json();
}