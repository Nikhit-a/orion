"use client";

import { useTripStore } from "@/store/trip-store";
import { useTripStream } from "@/hooks/use-trip-stream";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, CheckCircle2, XCircle, Loader2, Wifi } from "lucide-react";

interface AgentFeedProps {
  tripId: string | null;
}

export function AgentFeed({ tripId }: AgentFeedProps) {
  useTripStream(tripId);
  const agentEvents = useTripStore((s) => s.agentEvents);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-blue-500" />
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Agent Activity</span>
        {tripId ? (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-500">
            <Wifi className="h-3 w-3" /> Live
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1 text-xs text-neutral-400">
            <Loader2 className="h-3 w-3 animate-spin" /> Waiting
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 min-h-[120px] max-h-72 overflow-y-auto pr-1">
        <AnimatePresence mode="popLayout">
          {agentEvents.length === 0 && (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-neutral-400 text-center py-8"
            >
              No agent activity yet. Simulate an event to get started.
            </motion.p>
          )}
          {agentEvents.map((event) => (
            <motion.div
              key={event.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-start gap-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-3"
            >
              {event.message.toLowerCase().includes("reject") || event.message.toLowerCase().includes("failed") ? (
                <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              )}
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <p className="text-sm text-neutral-700 dark:text-neutral-200 leading-snug">{event.message}</p>
                <span className="text-xs text-neutral-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
