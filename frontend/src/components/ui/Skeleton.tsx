"use client";

import { cn } from "@/lib/utils";

/** Shimmer skeleton — warmer replacement for flat gray pulse boxes. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-xl bg-gradient-to-r from-amber-50 via-amber-100 to-amber-50 bg-[length:800px_100%]",
        className
      )}
      aria-hidden
    />
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3 rounded-2xl border-2 border-amber-100 bg-white p-5">
      <Skeleton className="h-10 w-10 !rounded-xl" />
      <Skeleton className="h-6 w-1/2" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}
