"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchActivities, type Activity } from "@/lib/api";
import { useTripStore } from "@/store/trip-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Plus, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export function PackageBuilder({ destinationId }: { destinationId: string }) {
  const itinerary = useTripStore((s) => s.itinerary);
  const addToItinerary = useTripStore((s) => s.addToItinerary);
  const removeFromItinerary = useTripStore((s) => s.removeFromItinerary);
  const [selectedDay, setSelectedDay] = useState(1);
  const totalDays = 5;

  const { data: activities, isLoading } = useQuery({
    queryKey: ["activities", destinationId],
    queryFn: () => fetchActivities(destinationId),
  });

  const totalCost = itinerary.reduce((sum, item) => sum + item.price, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <h3 className="font-semibold text-neutral-700 dark:text-neutral-300">Available Activities</h3>
        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3">
          {activities?.map((act) => (
            <Card key={act.id} className="flex flex-row items-center justify-between p-4 gap-4">
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-neutral-500">{act.activity_type}</span>
                  <p className="font-medium text-sm">{act.name}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-400">
                  {act.duration_mins && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{act.duration_mins}m</span>}
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{Number(act.base_price).toFixed(2)}</span>
                </div>
              </div>
              <Button size="sm" variant="outline"
                onClick={() => addToItinerary({ day: selectedDay, activityId: act.id, activityName: act.name, activityType: act.activity_type, price: Number(act.base_price) })}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add to Day {selectedDay}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-700 dark:text-neutral-300">Itinerary</h3>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Total: ${totalCost.toFixed(2)}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
            <button key={day} onClick={() => setSelectedDay(day)}
              className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${selectedDay === day ? "bg-blue-600 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200"}`}>
              {day}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 min-h-[200px]">
          <AnimatePresence>
            {itinerary.filter((item) => item.day === selectedDay).map((item) => (
              <motion.div key={`${item.day}-${item.activityId}`}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
                className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 bg-white dark:bg-neutral-900">
                <div>
                  <p className="text-sm font-medium">{item.activityName}</p>
                  <p className="text-xs text-neutral-400">${item.price.toFixed(2)}</p>
                </div>
                <button onClick={() => removeFromItinerary(item.day, item.activityId)} className="text-neutral-400 hover:text-red-500 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {itinerary.filter((i) => i.day === selectedDay).length === 0 && (
            <p className="text-sm text-neutral-400 text-center py-8">No activities for Day {selectedDay}. Add some!</p>
          )}
        </div>
      </div>
    </div>
  );
}
