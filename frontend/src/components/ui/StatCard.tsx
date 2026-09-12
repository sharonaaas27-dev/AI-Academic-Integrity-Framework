"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { CountUp } from "./CountUp";
import { cn } from "@/lib/utils";

const CHIP: Record<string, string> = {
  blue: "bg-sky-100 text-sky-600",
  green: "bg-emerald-100 text-emerald-600",
  yellow: "bg-amber-100 text-amber-600",
  purple: "bg-violet-100 text-violet-600",
  red: "bg-rose-100 text-rose-600",
  teal: "bg-teal-100 text-teal-600",
  orange: "bg-orange-100 text-orange-600",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  decimals = 0,
  suffix = "",
  color = "blue",
  index = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  decimals?: number;
  suffix?: string;
  color?: keyof typeof CHIP;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, type: "spring", stiffness: 260, damping: 22 }}
      whileHover={{ y: -4 }}
      className="rounded-2xl border-2 border-amber-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg"
    >
      <div className={cn("mb-3 w-fit rounded-xl p-3", CHIP[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-extrabold text-gray-900">
        {typeof value === "number" ? (
          <CountUp value={value} decimals={decimals} suffix={suffix} />
        ) : (
          value
        )}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-500">{label}</p>
    </motion.div>
  );
}
