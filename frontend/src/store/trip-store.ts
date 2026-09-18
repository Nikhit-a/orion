import { create } from "zustand";
import type { Destination, Guide, Activity, InferenceResolution } from "@/lib/api";

export type ItemStatus = "PLANNED" | "DISRUPTED" | "REPLACED" | "COMPLETED";

export interface ItineraryItem {
  day: number;
  activityId: string;
  activityName: string;
  activityType: string;
  price: number;
  status: ItemStatus;
  replacedBy?: string; // name of replacement
}

export interface InferenceStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done";
}

export interface AgentEvent {
  id: string;
  message: string;
  timestamp: string;
}

interface TripStore {
  // Selection
  selectedDestination: Destination | null;
  selectedGuide: Guide | null;

  // Saved trip
  savedTripId: string | null;
  savedTripPrice: number | null;

  // Itinerary
  itinerary: ItineraryItem[];

  // Inference streaming state
  isInferring: boolean;
  inferenceSteps: InferenceStep[];
  inferenceTokens: string;   // accumulated LLM reasoning text
  inferenceResolution: InferenceResolution | null;

  // SSE agent events
  agentEvents: AgentEvent[];

  // Actions
  setDestination: (d: Destination | null) => void;
  setGuide: (g: Guide | null) => void;
  setSavedTrip: (id: string, price: number) => void;

  addToItinerary: (item: Omit<ItineraryItem, "status">) => void;
  removeFromItinerary: (day: number, activityId: string) => void;
  applyResolution: (res: InferenceResolution) => void;

  // Inference
  startInference: (steps: InferenceStep[]) => void;
  setStepRunning: (stepId: string) => void;
  setStepDone: (stepId: string) => void;
  appendToken: (token: string) => void;
  setResolution: (res: InferenceResolution) => void;
  finishInference: () => void;

  addAgentEvent: (e: AgentEvent) => void;
  resetTrip: () => void;
}

const INFERENCE_STEPS: InferenceStep[] = [
  { id: "retrieve", label: "Retrieve context", status: "pending" },
  { id: "search",   label: "Semantic search",  status: "pending" },
  { id: "plan",     label: "LLM reasoning",    status: "pending" },
  { id: "validate", label: "Validate plan",    status: "pending" },
  { id: "commit",   label: "Commit action",    status: "pending" },
];

export const useTripStore = create<TripStore>((set) => ({
  selectedDestination: null,
  selectedGuide: null,
  savedTripId: null,
  savedTripPrice: null,
  itinerary: [],
  isInferring: false,
  inferenceSteps: INFERENCE_STEPS,
  inferenceTokens: "",
  inferenceResolution: null,
  agentEvents: [],

  setDestination: (d) => set({ selectedDestination: d }),
  setGuide: (g) => set({ selectedGuide: g }),
  setSavedTrip: (id, price) => set({ savedTripId: id, savedTripPrice: price }),

  addToItinerary: (item) =>
    set((s) => ({
      itinerary: [...s.itinerary, { ...item, status: "PLANNED" }],
    })),

  removeFromItinerary: (day, activityId) =>
    set((s) => ({
      itinerary: s.itinerary.filter(
        (i) => !(i.day === day && i.activityId === activityId)
      ),
    })),

  applyResolution: (res) =>
    set((s) => ({
      itinerary: s.itinerary.map((item) => {
        if (item.activityName === res.old_item && item.status === "PLANNED") {
          return {
            ...item,
            status: "REPLACED",
            replacedBy: res.new_item,
            price: item.price + res.cost_delta,
          };
        }
        return item;
      }),
    })),

  startInference: (steps) =>
    set({ isInferring: true, inferenceSteps: steps, inferenceTokens: "", inferenceResolution: null }),

  setStepRunning: (id) =>
    set((s) => ({
      inferenceSteps: s.inferenceSteps.map((step) =>
        step.id === id ? { ...step, status: "running" } : step
      ),
    })),

  setStepDone: (id) =>
    set((s) => ({
      inferenceSteps: s.inferenceSteps.map((step) =>
        step.id === id ? { ...step, status: "done" } : step
      ),
    })),

  appendToken: (token) =>
    set((s) => ({ inferenceTokens: s.inferenceTokens + token })),

  setResolution: (res) => set({ inferenceResolution: res }),

  finishInference: () => set({ isInferring: false }),

  addAgentEvent: (e) =>
    set((s) => ({ agentEvents: [e, ...s.agentEvents] })),

  resetTrip: () =>
    set({
      selectedDestination: null,
      selectedGuide: null,
      savedTripId: null,
      savedTripPrice: null,
      itinerary: [],
      isInferring: false,
      inferenceSteps: INFERENCE_STEPS,
      inferenceTokens: "",
      inferenceResolution: null,
    }),
}));
