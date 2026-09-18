"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useTripStore, type ItineraryItem, type ItemStatus } from "@/store/trip-store";
import { Clock, DollarSign, Trash2, ArrowRight, CheckCircle2, AlertTriangle, RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PLANNED:   { label: "Planned",   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",   icon: <CheckCircle2 className="h-3 w-3" /> },
  DISRUPTED: { label: "Disrupted", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",       icon: <AlertTriangle className="h-3 w-3" /> },
  REPLACED:  { label: "Replaced",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <RefreshCw className="h-3 w-3" /> },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle2 className="h-3 w-3" /> },
};

const TYPE_COLORS: Record<string, string> = {
  ATTRACTION: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  RESTAURANT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  TRANSFER:   "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  ACTIVITY:   "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
};

export function ItineraryTimeline() {
  const itinerary = useTripStore((s) => s.itinerary);
  const savedTripPrice = useTripStore((s) => s.savedTripPrice);
  const removeFromItinerary = useTripStore((s) => s.removeFromItinerary);
  const isInferring = useTripStore((s) => s.isInferring);

  // Group by day
  const byDay = itinerary.reduce<Record<number, ItineraryItem[]>>((acc, item) => {
    if (!acc[item.day]) acc[item.day] = [];
    acc[item.day].push(item);
    return acc;
  }, {});

  const days = Object.keys(byDay)
    .map(Number)
    .sort((a, b) => a - b);

  const localTotal = itinerary.reduce((sum, i) => sum + i.price, 0);

  if (itinerary.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          <Zap className="h-5 w-5 text-neutral-400" />
        </div>
        <p className="text-sm text-neutral-400">No activities added yet.</p>
        <p className="text-xs text-neutral-300 dark:text-neutral-600">Browse the catalog and add items to your days.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cost summary bar */}
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-white shadow-md">
        <div className="flex flex-col">
          <span className="text-xs opacity-70">Total estimated cost</span>
          <span className="text-2xl font-bold">${localTotal.toFixed(2)}</span>
        </div>
        {savedTripPrice !== null && (
          <div className="flex flex-col items-end">
            <span className="text-xs opacity-70">Confirmed price (with fees)</span>
            <span className="text-xl font-semibold">${Number(savedTripPrice).toFixed(2)}</span>
          </div>
        )}
        {isInferring && (
          <div className="flex items-center gap-2 text-xs opacity-80 animate-pulse">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Agent resolving…
          </div>
        )}
      </div>

      {/* Day groups */}
      <AnimatePresence>
        {days.map((day) => (
          <motion.div
            key={day}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold shrink-0">
                {day}
              </div>
              <span className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                Day {day}
              </span>
              <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
              <span className="text-xs text-neutral-400">
                ${byDay[day].reduce((s, i) => s + i.price, 0).toFixed(2)}
              </span>
            </div>

            {/* Timeline items */}
            <div className="ml-3.5 border-l-2 border-dashed border-neutral-200 dark:border-neutral-700 pl-5 flex flex-col gap-3">
              <AnimatePresence>
                {byDay[day].map((item) => (
                  <TimelineItem
                    key={item.activityId}
                    item={item}
                    onRemove={() => removeFromItinerary(item.day, item.activityId)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function TimelineItem({ item, onRemove }: { item: ItineraryItem; onRemove: () => void }) {
  const cfg = STATUS_CONFIG[item.status];
  const typeColor = TYPE_COLORS[item.activityType] ?? TYPE_COLORS.ACTIVITY;
  const isReplaced = item.status === "REPLACED";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border p-4 transition-all",
        isReplaced
          ? "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/20"
          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium shrink-0", typeColor)}>
            {item.activityType}
          </span>
          <span className={cn(
            "text-sm font-semibold truncate",
            isReplaced ? "line-through text-neutral-400" : "text-neutral-900 dark:text-white"
          )}>
            {item.activityName}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", cfg.color)}>
            {cfg.icon}{cfg.label}
          </span>
          {item.status === "PLANNED" && (
            <button onClick={onRemove} className="text-neutral-300 hover:text-red-500 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Replacement row */}
      <AnimatePresence>
        {isReplaced && item.replacedBy && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 font-medium"
          >
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            <span>{item.replacedBy}</span>
            <span className="text-xs text-neutral-400 font-normal ml-auto">AI replacement</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom row */}
      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />{item.price.toFixed(2)}
        </span>
      </div>
    </motion.div>
  );
}
