"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Users, Layers, Zap, Save, Loader2, ChevronRight, Star, Languages, Tag,
} from "lucide-react";
import { fetchGuides, fetchActivities, createTrip } from "@/lib/api";
import { useTripStore } from "@/store/trip-store";
import { ActivityCatalog } from "@/components/activity-catalog";
import { ItineraryTimeline } from "@/components/itinerary-timeline";
import { InferencePanel } from "@/components/inference-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "catalog" | "itinerary" | "agent";

const DEMO_USER_ID = "fc735bbe-2e7d-4b6f-a7a7-d4eec465b21e";

export function DestinationView({ destinationId }: { destinationId: string }) {
  const [tab, setTab] = useState<Tab>("catalog");

  const selectedDestination = useTripStore((s) => s.selectedDestination);
  const selectedGuide       = useTripStore((s) => s.selectedGuide);
  const setGuide            = useTripStore((s) => s.setGuide);
  const itinerary           = useTripStore((s) => s.itinerary);
  const setSavedTrip        = useTripStore((s) => s.setSavedTrip);
  const isInferring         = useTripStore((s) => s.isInferring);

  const { data: guides, isLoading: guidesLoading } = useQuery({
    queryKey: ["guides", destinationId],
    queryFn: () => fetchGuides(destinationId),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      createTrip({
        user_id: DEMO_USER_ID,
        name: `${selectedDestination?.name ?? "Trip"} — ${new Date().toLocaleDateString()}`,
        start_date: new Date().toISOString().split("T")[0],
        end_date: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
        items: itinerary.map((i) => ({
          day_number: i.day,
          component_type: i.activityType,
          component_id: i.activityId,
        })),
      }),
    onSuccess: (data) => {
      setSavedTrip(data.id, data.total_price);
      setTab("itinerary");
    },
  });

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "catalog",   label: "Activities",  icon: <Layers className="h-4 w-4" /> },
    { id: "itinerary", label: "Itinerary",   icon: <MapPin className="h-4 w-4" />, badge: itinerary.length },
    { id: "agent",     label: "AI Agent",    icon: <Zap className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Top header */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-blue-500" />
          <div>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
              {selectedDestination?.name ?? "Destination"}
            </h1>
            <p className="text-xs text-neutral-400">{selectedDestination?.country}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {isInferring && (
              <div className="flex items-center gap-2 text-xs text-blue-500 animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                AI resolving disruption…
              </div>
            )}
            <Button
              size="sm"
              disabled={itinerary.length === 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="gap-1.5"
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
              ) : (
                <><Save className="h-3.5 w-3.5" />Save Trip</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* Left sidebar — Guide selection */}
        <div className="w-72 shrink-0 flex flex-col gap-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-neutral-400" />
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Choose Guide</span>
            </div>

            {guidesLoading && (
              <div className="flex flex-col gap-2">
                {[1, 2].map((n) => <div key={n} className="h-24 rounded-lg bg-neutral-100 dark:bg-neutral-800 animate-pulse" />)}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {guides?.map((guide) => {
                const selected = selectedGuide?.id === guide.id;
                return (
                  <button
                    key={guide.id}
                    onClick={() => setGuide(selected ? null : guide)}
                    className={cn(
                      "w-full text-left rounded-xl border-2 p-3 transition-all",
                      selected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                        : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 bg-white dark:bg-neutral-900"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                        {guide.name}
                      </span>
                      {guide.rating && (
                        <div className="flex items-center gap-0.5 text-xs text-amber-500 shrink-0">
                          <Star className="h-3 w-3 fill-amber-400" />
                          {Number(guide.rating).toFixed(1)}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2 mb-2">{guide.bio}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {guide.specializations?.slice(0, 2).map((s) => (
                        <span key={s} className="inline-flex items-center gap-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300">
                          <Tag className="h-2 w-2" />{s}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-400">
                      <div className="flex items-center gap-1">
                        <Languages className="h-3 w-3" />
                        {guide.languages?.join(", ")}
                      </div>
                      <span className="font-semibold text-neutral-700 dark:text-neutral-200">
                        ${Number(guide.base_price_per_day).toFixed(0)}/day
                      </span>
                    </div>
                    {selected && (
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-semibold">✓ Selected</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mini itinerary summary in sidebar */}
          {itinerary.length > 0 && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Summary</span>
                <button onClick={() => setTab("itinerary")} className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                  View <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: 5 }, (_, i) => i + 1).map((day) => {
                  const count = itinerary.filter((i) => i.day === day).length;
                  if (count === 0) return null;
                  return (
                    <div key={day} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">Day {day}</span>
                      <span className="font-medium text-neutral-700 dark:text-neutral-300">{count} item{count > 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
                <div className="mt-1 pt-1 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs font-semibold">
                  <span className="text-neutral-500">Total</span>
                  <span className="text-neutral-900 dark:text-white">
                    ${itinerary.reduce((s, i) => s + i.price, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Tab bar */}
          <div className="flex gap-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  tab === t.id
                    ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                )}
              >
                {t.icon}
                {t.label}
                {t.badge != null && t.badge > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                    {t.badge}
                  </span>
                )}
                {t.id === "agent" && isInferring && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5"
            >
              {tab === "catalog"   && <ActivityCatalog destinationId={destinationId} />}
              {tab === "itinerary" && <ItineraryTimeline />}
              {tab === "agent"     && <InferencePanel />}
            </motion.div>
          </AnimatePresence>

          {/* Save success banner */}
          <AnimatePresence>
            {saveMutation.isSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 px-4 py-3 flex items-center gap-3"
              >
                <Zap className="h-4 w-4 text-green-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-green-800 dark:text-green-300">Trip saved!</span>
                  <span className="text-xs text-neutral-500">
                    Final price: ${Number(saveMutation.data?.total_price ?? 0).toFixed(2)} · ID: {saveMutation.data?.id?.slice(0, 8)}…
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
