import { useSyncExternalStore } from "react";
import type { Scenario } from "./mock-data";
import { fetchScenarios, createScenarioApi, deleteScenarioApi } from "./api";

type Listener = () => void;
const listeners = new Set<Listener>();
let _scenarios: Scenario[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function getSnapshot() {
  return _scenarios;
}

export function useScenarios(): Scenario[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getAllScenarios(): Scenario[] {
  return _scenarios;
}

export async function seedScenariosFromBackend(): Promise<void> {
  try {
    const data = await fetchScenarios();
    _scenarios = data as unknown as Scenario[];
    emit();
  } catch {
    // DB unavailable — stay empty
  }
}

export async function createScenario(
  input: Omit<Scenario, "id"> & { id?: string },
): Promise<Scenario> {
  const id = input.id ?? `scn-${Date.now()}`;
  try {
    const created = await createScenarioApi({
      id,
      name: input.name,
      networkId: input.networkId,
      simType: input.simType,
      mode: input.mode,
      horizon: input.horizon,
      timestep: input.timestep ?? "15min",
      createdBy: input.createdBy,
    });
    const s = created as unknown as Scenario;
    _scenarios = [s, ..._scenarios];
    emit();
    return s;
  } catch {
    const s: Scenario = {
      id,
      name: input.name,
      networkId: input.networkId,
      simType: input.simType,
      mode: input.mode,
      horizon: input.horizon,
      timestep: input.timestep ?? "15min",
      createdBy: input.createdBy,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    _scenarios = [s, ..._scenarios];
    emit();
    return s;
  }
}

export async function removeScenario(id: string): Promise<void> {
  try {
    await deleteScenarioApi(id);
  } catch {
    // DB unavailable — remove from memory anyway
  }
  _scenarios = _scenarios.filter((s) => s.id !== id);
  emit();
}
