"use client";

import { useEffect, useRef } from "react";
import { useTripStore } from "@/store/trip-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useTripStream(tripId: string | null) {
  const addAgentEvent = useTripStore((s) => s.addAgentEvent);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!tripId) return;

    const es = new EventSource(`${API_URL}/api/v1/stream/trip/${tripId}`);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "agent_action") {
          addAgentEvent({
            id: data.action_id ?? crypto.randomUUID(),
            message: data.reasoning_summary ?? "Agent took an action.",
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        // heartbeat / non-JSON — ignore
      }
    };

    es.onerror = () => {
      console.warn("[SSE] Connection error — will retry automatically.");
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [tripId, addAgentEvent]);
}
