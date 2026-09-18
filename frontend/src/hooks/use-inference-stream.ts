"use client";

import { useCallback, useRef } from "react";
import { streamInference, type InferenceResolution } from "@/lib/api";
import { useTripStore, type InferenceStep } from "@/store/trip-store";

const STEPS: InferenceStep[] = [
  { id: "retrieve", label: "Retrieve context",   status: "pending" },
  { id: "search",   label: "Semantic search",    status: "pending" },
  { id: "plan",     label: "LLM reasoning",      status: "pending" },
  { id: "validate", label: "Validate plan",      status: "pending" },
  { id: "commit",   label: "Commit action",      status: "pending" },
];

export function useInferenceStream() {
  const abortRef = useRef<(() => void) | null>(null);

  const startInference  = useTripStore((s) => s.startInference);
  const setStepRunning  = useTripStore((s) => s.setStepRunning);
  const setStepDone     = useTripStore((s) => s.setStepDone);
  const appendToken     = useTripStore((s) => s.appendToken);
  const setResolution   = useTripStore((s) => s.setResolution);
  const finishInference = useTripStore((s) => s.finishInference);
  const applyResolution = useTripStore((s) => s.applyResolution);
  const addAgentEvent   = useTripStore((s) => s.addAgentEvent);

  const run = useCallback(
    (eventType: string, payload: Record<string, unknown>) => {
      if (abortRef.current) abortRef.current();

      startInference(STEPS.map((s) => ({ ...s, status: "pending" as const })));

      const abort = streamInference(eventType, payload, {
        onStepStart: (step, _label) => setStepRunning(step),
        onToken: (token) => appendToken(token),
        onStepDone: (step) => setStepDone(step),
        onResolution: (res: InferenceResolution) => {
          setResolution(res);
          applyResolution(res);
          addAgentEvent({
            id: crypto.randomUUID(),
            message: res.summary,
            timestamp: new Date().toISOString(),
          });
        },
        onDone: () => finishInference(),
        onError: (err) => {
          console.error("[inference]", err);
          finishInference();
        },
      });

      abortRef.current = abort;
    },
    [startInference, setStepRunning, appendToken, setStepDone, setResolution, applyResolution, finishInference, addAgentEvent]
  );

  return { run };
}
