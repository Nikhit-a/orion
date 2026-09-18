"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchDestinations, type Destination } from "@/lib/api";
import { useTripStore } from "@/store/trip-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const setDestination = useTripStore((s) => s.setDestination);

  const { data: destinations, isLoading, isError } = useQuery({
    queryKey: ["destinations"],
    queryFn: fetchDestinations,
  });

  const filtered = destinations?.filter(
    (d) =>
      !searchQuery ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center gap-8 px-4 py-32 text-center bg-gradient-to-b from-blue-50 to-white dark:from-neutral-950 dark:to-neutral-900">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-4"
        >
          <span className="rounded-full bg-blue-100 px-4 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 uppercase tracking-wide">
            AI-Powered Travel
          </span>
          <h1 className="text-5xl font-bold tracking-tight text-neutral-900 dark:text-white max-w-2xl">
            Build your perfect trip with an AI that adapts
          </h1>
          <p className="text-lg text-neutral-500 dark:text-neutral-400 max-w-xl">
            PackagePro crafts dynamic itineraries and automatically resolves disruptions — in real time.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="relative flex w-full max-w-xl items-center gap-2"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
          <Input
            placeholder="Search destinations... e.g. 'beach with history'"
            className="h-12 pl-10 text-base rounded-xl shadow-md"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </motion.div>
      </section>

      {/* Destination Grid */}
      <section className="flex-1 px-6 py-12 max-w-6xl mx-auto w-full">
        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-6">
          {searchQuery ? `Results for "${searchQuery}"` : "Popular Destinations"}
        </h2>

        {isLoading && (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}

        {isError && (
          <p className="text-center py-24 text-red-500">
            Could not load destinations. Make sure the backend is running.
          </p>
        )}

        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered?.map((dest) => (
              <DestinationCard key={dest.id} destination={dest} onSelect={setDestination} />
            ))}
          </div>
        </AnimatePresence>

        {filtered?.length === 0 && !isLoading && (
          <p className="text-center py-24 text-neutral-400">No destinations match your search.</p>
        )}
      </section>
    </main>
  );
}

function DestinationCard({ destination, onSelect }: { destination: Destination; onSelect: (d: Destination) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <MapPin className="h-3 w-3" />
            <span>{destination.country}</span>
          </div>
          <CardTitle>{destination.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 justify-between gap-4">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-3">
            {destination.description ?? "Explore this amazing destination."}
          </p>
          <Link href={`/destinations/${destination.id}`} onClick={() => onSelect(destination)}>
            <Button className="w-full">Explore & Build Trip</Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}
