"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { simulateEvent } from "@/lib/api";
import { Zap, Loader2 } from "lucide-react";

const PRESETS = [
  { label: "Attraction Closed", event_type: "ATTRACTION_CLOSED", payload: { attraction: "Eiffel Tower", reason: "Strike" } },
  { label: "Weather Warning", event_type: "WEATHER_WARNING", payload: { severity: "high", area: "City Centre" } },
  { label: "Guide Unavailable", event_type: "GUIDE_UNAVAILABLE", payload: { guide: "Pierre Dubois", date: "2025-12-20" } },
];

export function SimulateEventPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSimulate(preset: typeof PRESETS[number]) {
    setLoading(true);
    setResult(null);
    try {
      const res = await simulateEvent({ event_type: preset.event_type, payload: preset.payload }) as { event_id: string };
      setResult(`✓ Event dispatched (ID: ${res.event_id})`);
    } catch (err) {
      setResult(`✗ Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">Choose a preset disruption to dispatch to the AI agent pipeline:</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button key={preset.event_type} variant="outline" size="sm" disabled={loading} onClick={() => handleSimulate(preset)} className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-amber-500" />{preset.label}
            </Button>
          ))}
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />Dispatching event to Kafka...
          </div>
        )}
        {result && (
          <p className={`text-xs font-medium ${result.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{result}</p>
        )}
      </CardContent>
    </Card>
  );
}
