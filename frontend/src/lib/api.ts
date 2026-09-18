const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  description: string | null;
}
export const fetchDestinations = (): Promise<Destination[]> =>
  apiFetch("/api/v1/discovery/destinations");

export interface Guide {
  id: string;
  name: string;
  bio: string | null;
  languages: string[];
  specializations: string[];
  base_price_per_day: number;
  rating: number | null;
}
export const fetchGuides = (destinationId?: string): Promise<Guide[]> => {
  const qs = destinationId ? `?destination_id=${destinationId}` : "";
  return apiFetch(`/api/v1/discovery/guides${qs}`);
};

export interface Activity {
  id: string;
  name: string;
  activity_type: string;
  description: string | null;
  base_price: number;
  duration_mins: number | null;
}
export const fetchActivities = (destinationId: string): Promise<Activity[]> =>
  apiFetch(`/api/v1/discovery/destinations/${destinationId}/activities`);

export interface TripResponse {
  id: string;
  name: string;
  total_price: number;
  status: string;
  itinerary_items: { id: string; day_number: number; component_type: string; component_id: string; status: string }[];
}
export const createTrip = (body: {
  user_id: string;
  name: string;
  start_date: string;
  end_date: string;
  items: { day_number: number; component_type: string; component_id: string }[];
}): Promise<TripResponse> =>
  apiFetch("/api/v1/trips/", { method: "POST", body: JSON.stringify(body) });

export const simulateEvent = (payload: {
  event_type: string;
  payload: Record<string, unknown>;
}) => apiFetch<{ event_id: string; status: string; message: string }>(
  "/api/v1/events/simulate",
  { method: "POST", body: JSON.stringify(payload) }
);

/** Opens a streaming fetch to the inference endpoint and calls callbacks. */
export function streamInference(
  eventType: string,
  payload: Record<string, unknown>,
  callbacks: {
    onStepStart: (step: string, label: string) => void;
    onToken: (token: string) => void;
    onStepDone: (step: string) => void;
    onResolution: (res: InferenceResolution) => void;
    onDone: () => void;
    onError: (err: string) => void;
  }
): () => void {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/inference/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_type: eventType, payload }),
        signal: ctrl.signal,
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));
          if (data.type === "step_start") callbacks.onStepStart(data.step, data.label);
          else if (data.type === "token") callbacks.onToken(data.token);
          else if (data.type === "step_done") callbacks.onStepDone(data.step);
          else if (data.type === "resolution") callbacks.onResolution(data as InferenceResolution);
          else if (data.type === "done") callbacks.onDone();
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError")
        callbacks.onError((e as Error).message);
    }
  })();

  return () => ctrl.abort();
}

export interface InferenceResolution {
  type: string;
  old_item: string;
  new_item: string;
  cost_delta: number;
  status: string;
  summary: string;
}
