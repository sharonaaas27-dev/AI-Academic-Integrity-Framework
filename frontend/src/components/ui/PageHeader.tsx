"use client";

import { motion } from "framer-motion";
import { OwlMascot } from "@/components/illustrations/OwlMascot";

export function PageHeader({
  title,
  subtitle,
  mascot = true,
  actions,
}: {
  title: string;
  subtitle?: string;
  mascot?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-amber-100 bg-gradient-to-r from-amber-50 via-white to-teal-50 p-4 shadow-sm"
    >
      {mascot && <OwlMascot className="h-14 w-14" />}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-extrabold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
