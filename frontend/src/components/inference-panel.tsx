"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTripStore } from "@/store/trip-store";
import { useInferenceStream } from "@/hooks/use-inference-stream";
import { simulateEvent } from "@/lib/api";
import { Zap, Loader2, CheckCircle2, Circle, RefreshCw, Wifi, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESETS = [
  {
    label: "Attraction Closed",
    emoji: "🚫",
    event_type: "ATTRACTION_CLOSED",
    payload: { attraction: "Eiffel Tower", reason: "Strike" },
    color: "border-red-200 hover:border-red-400 dark:border-red-800 dark:hover:border-red-600",
  },
  {
    label: "Weather Warning",
    emoji: "⛈️",
    event_type: "WEATHER_WARNING",
    payload: { severity: "high", area: "City Centre" },
    color: "border-sky-200 hover:border-sky-400 dark:border-sky-800 dark:hover:border-sky-600",
  },
  {
    label: "Guide Unavailable",
    emoji: "👤",
    event_type: "GUIDE_UNAVAILABLE",
    payload: { guide: "Pierre Dubois", date: "2025-12-20" },
    color: "border-amber-200 hover:border-amber-400 dark:border-amber-800 dark:hover:border-amber-600",
  },
];

export function InferencePanel() {
  const { run } = useInferenceStream();
  const [dispatching, setDispatching] = useState(false);
  const [expandReasoning, setExpandReasoning] = useState(true);

  const isInferring       = useTripStore((s) => s.isInferring);
  const inferenceSteps    = useTripStore((s) => s.inferenceSteps);
  const inferenceTokens   = useTripStore((s) => s.inferenceTokens);
  const inferenceResolution = useTripStore((s) => s.inferenceResolution);
  const agentEvents       = useTripStore((s) => s.agentEvents);

  async function handlePreset(preset: typeof PRESETS[number]) {
    setDispatching(true);
    try {
      // Fire Kafka event in parallel (best effort)
      simulateEvent({ event_type: preset.event_type, payload: preset.payload }).catch(() => {});
      // Start streaming inference immediately
      run(preset.event_type, preset.payload);
    } finally {
      setDispatching(false);
    }
  }

  const activeStep = inferenceSteps.find((s) => s.status === "running");

  return (
    <div className="flex flex-col gap-5">
      {/* Preset disruption buttons */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          Simulate a disruption
        </p>
        <div className="grid grid-cols-1 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.event_type}
              disabled={isInferring || dispatching}
              onClick={() => handlePreset(preset)}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 bg-white dark:bg-neutral-900 px-4 py-3 text-left transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                preset.color
              )}
            >
              <span className="text-lg">{preset.emoji}</span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{preset.label}</span>
                <span className="text-xs text-neutral-400">
                  {Object.entries(preset.payload).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </span>
              </div>
              {(isInferring || dispatching) ? null : (
                <Zap className="h-4 w-4 text-amber-500 ml-auto shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Inference pipeline */}
      <AnimatePresence>
        {(isInferring || inferenceResolution) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4"
          >
            {/* Header */}
            <div className="flex items-center gap-2">
              {isInferring ? (
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                {isInferring ? (activeStep ? activeStep.label + "…" : "Processing…") : "Resolution complete"}
              </span>
              {!isInferring && (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-500">
                  <Wifi className="h-3 w-3" /> Done
                </span>
              )}
            </div>

            {/* Step pipeline */}
            <div className="flex items-center gap-1.5">
              {inferenceSteps.map((step, i) => (
                <div key={step.id} className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                    <div className={cn(
                      "h-1.5 w-full rounded-full transition-all duration-500",
                      step.status === "done"    && "bg-green-500",
                      step.status === "running" && "bg-blue-500 animate-pulse",
                      step.status === "pending" && "bg-neutral-200 dark:bg-neutral-700"
                    )} />
                    <span className="text-[10px] text-neutral-400 truncate w-full text-center hidden sm:block">
                      {step.label}
                    </span>
                  </div>
                  {i < inferenceSteps.length - 1 && (
                    <div className="h-px w-2 bg-neutral-200 dark:bg-neutral-700 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {/* LLM reasoning stream */}
            {inferenceTokens && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setExpandReasoning((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                >
                  {expandReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  Agent reasoning
                  {isInferring && <RefreshCw className="h-3 w-3 animate-spin ml-1" />}
                </button>
                <AnimatePresence>
                  {expandReasoning && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-lg bg-neutral-950 dark:bg-black p-3 font-mono text-xs text-green-400 leading-relaxed max-h-36 overflow-y-auto">
                        {inferenceTokens}
                        {isInferring && <span className="animate-pulse">▋</span>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Resolution card */}
            <AnimatePresence>
              {inferenceResolution && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-sm font-semibold text-green-800 dark:text-green-300">
                      {inferenceResolution.summary}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="line-through">{inferenceResolution.old_item}</span>
                    <span>→</span>
                    <span className="font-medium text-green-700 dark:text-green-400">{inferenceResolution.new_item}</span>
                    {inferenceResolution.cost_delta !== 0 && (
                      <span className={cn("ml-auto font-medium", inferenceResolution.cost_delta > 0 ? "text-red-500" : "text-green-500")}>
                        {inferenceResolution.cost_delta > 0 ? "+" : ""}{inferenceResolution.cost_delta.toFixed(2)}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent event history */}
      {agentEvents.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Event history
          </p>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
            {agentEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 p-2.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-snug">{e.message}</p>
                  <span className="text-[10px] text-neutral-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
