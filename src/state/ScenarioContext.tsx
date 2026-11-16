import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, fetchScenario } from "../api/client";
import type { ScenarioResponse } from "../api/types";

// Holds the latest API response and the bump the reader chose. Every change of the bump asks the R API.

export const BUMP_TENOR = "5Y";
export const BUMP_BP = 1;

export type OisInterpolation = "log_linear" | "monotonic_log_cubic";

interface ScenarioState {
  data: ScenarioResponse | null;
  bumpBp: number;
  interpolation: OisInterpolation;
  loading: boolean;
  error: string | null;
  setBumpBp: (bp: number) => void;
  setInterpolation: (method: OisInterpolation) => void;
  retry: () => void;
}

const ScenarioContext = createContext<ScenarioState | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [bumpBp, setBumpBpState] = useState(0);
  const [interpolation, setInterpolationState] = useState<OisInterpolation>("log_linear");
  const [data, setData] = useState<ScenarioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    setError(null);
    fetchScenario({ bumpTenor: BUMP_TENOR, bumpBp, interpolation }, { signal: c.signal })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof ApiError ? e.message : String(e));
        setLoading(false);
      });
    return () => c.abort();
  }, [bumpBp, interpolation, attempt]);

  const setBumpBp = useCallback((bp: number) => setBumpBpState(bp), []);
  const setInterpolation = useCallback((method: OisInterpolation) => setInterpolationState(method), []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <ScenarioContext.Provider value={{ data, bumpBp, interpolation, loading, error, setBumpBp, setInterpolation, retry }}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenario(): ScenarioState {
  const s = useContext(ScenarioContext);
  if (!s) throw new Error("useScenario must be used inside ScenarioProvider");
  return s;
}

/** The changed case is shown only when the response is for a non-zero bump. */
export function hasScenario(data: ScenarioResponse | null): boolean {
  return data !== null && data.request.bumpBp !== 0;
}
