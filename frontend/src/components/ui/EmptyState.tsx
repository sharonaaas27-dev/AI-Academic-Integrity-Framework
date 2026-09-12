"use client";

import { motion } from "framer-motion";

export function EmptyState({
  art,
  title,
  hint,
  action,
}: {
  art: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center py-10 text-center"
    >
      {art}
      <p className="mt-4 font-semibold text-gray-700">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-gray-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
