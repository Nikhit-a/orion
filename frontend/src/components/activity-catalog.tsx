"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchActivities, type Activity } from "@/lib/api";
import { useTripStore } from "@/store/trip-store";
import { Clock, DollarSign, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const TYPE_COLORS: Record<string, string> = {
  ATTRACTION: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  RESTAURANT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  TRANSFER:   "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  ACTIVITY:   "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

export function ActivityCatalog({ destinationId }: { destinationId: string }) {
  const [selectedDay, setSelectedDay] = useState(1);
  const [search, setSearch] = useState("");
  const totalDays = 5;

  const addToItinerary = useTripStore((s) => s.addToItinerary);
  const itinerary = useTripStore((s) => s.itinerary);

  const { data: activities, isLoading } = useQuery({
    queryKey: ["activities", destinationId],
    queryFn: () => fetchActivities(destinationId),
  });

  const filtered = activities?.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.activity_type.toLowerCase().includes(search.toLowerCase())
  );

  const alreadyAdded = (id: string, day: number) =>
    itinerary.some((i) => i.activityId === id && i.day === day);

  return (
    <div className="flex flex-col gap-4">
      {/* Day selector */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-neutral-400 shrink-0">Add to day:</span>
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
            const count = itinerary.filter((i) => i.day === day).length;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "relative h-8 min-w-[2rem] px-2 rounded-lg text-sm font-medium transition-colors",
                  selectedDay === day
                    ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                )}
              >
                {day}
                {count > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
        <Input
          className="pl-8 h-9 text-sm"
          placeholder="Filter activities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Activity list */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-16 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
          ))}
        </div>
      )}

      <AnimatePresence mode="popLayout">
        <div className="flex flex-col gap-2">
          {filtered?.map((act) => {
            const added = alreadyAdded(act.id, selectedDay);
            const typeColor = TYPE_COLORS[act.activity_type] ?? TYPE_COLORS.ACTIVITY;
            return (
              <motion.div
                key={act.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 transition-all",
                  added
                    ? "border-blue-200 bg-blue-50 dark:border-blue-800/40 dark:bg-blue-950/20"
                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
                )}
              >
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0", typeColor)}>
                      {act.activity_type}
                    </span>
                    <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100 truncate">{act.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-400">
                    {act.duration_mins && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{act.duration_mins}m</span>
                    )}
                    <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{Number(act.base_price).toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant={added ? "default" : "outline"}
                  disabled={added}
                  onClick={() => addToItinerary({
                    day: selectedDay,
                    activityId: act.id,
                    activityName: act.name,
                    activityType: act.activity_type,
                    price: Number(act.base_price),
                  })}
                  className="shrink-0"
                >
                  {added ? "✓ Added" : <><Plus className="h-3.5 w-3.5 mr-1" />Add</>}
                </Button>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>

      {filtered?.length === 0 && !isLoading && (
        <p className="text-sm text-neutral-400 text-center py-6">No activities match your filter.</p>
      )}
    </div>
  );
}
