"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGuides, type Guide } from "@/lib/api";
import { useTripStore } from "@/store/trip-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Languages, Tag } from "lucide-react";
import { motion } from "framer-motion";

export function GuidesSelector({ destinationId }: { destinationId: string }) {
  const selectedGuide = useTripStore((s) => s.selectedGuide);
  const setGuide = useTripStore((s) => s.setGuide);

  const { data: guides, isLoading } = useQuery({
    queryKey: ["guides", destinationId],
    queryFn: () => fetchGuides(destinationId),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((n) => (
          <div key={n} className="h-48 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {guides?.map((guide) => (
        <motion.div key={guide.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          <Card
            className={`transition-all cursor-pointer ${selectedGuide?.id === guide.id ? "ring-2 ring-blue-500 border-blue-500" : "hover:shadow-md"}`}
            onClick={() => setGuide(selectedGuide?.id === guide.id ? null : guide)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{guide.name}</CardTitle>
              {guide.rating && (
                <div className="flex items-center gap-1 text-xs text-amber-500">
                  <Star className="h-3 w-3 fill-amber-400" />
                  <span>{Number(guide.rating).toFixed(1)}</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">{guide.bio ?? "Experienced local guide."}</p>
              <div className="flex flex-wrap gap-2">
                {guide.specializations?.slice(0, 3).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-400">
                    <Tag className="h-2.5 w-2.5" />{s}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1 text-xs text-neutral-400">
                  <Languages className="h-3 w-3" />{guide.languages?.join(", ")}
                </div>
                <span className="font-semibold text-sm">${Number(guide.base_price_per_day).toFixed(0)}/day</span>
              </div>
              <Button variant={selectedGuide?.id === guide.id ? "default" : "outline"} size="sm" className="w-full"
                onClick={(e) => { e.stopPropagation(); setGuide(selectedGuide?.id === guide.id ? null : guide); }}>
                {selectedGuide?.id === guide.id ? "✓ Selected" : "Select Guide"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
