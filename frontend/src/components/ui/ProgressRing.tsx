"use client";

import { motion } from "framer-motion";

/** Circular progress ring — exam timer / score display. */
export function ProgressRing({
  progress,
  size = 64,
  stroke = 7,
  urgent = false,
  label,
}: {
  progress: number; // 0..1
  size?: number;
  stroke?: number;
  urgent?: boolean;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#fde68a" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={urgent ? "#f43f5e" : "#14b8a6"}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - clamped) }}
          transition={{ duration: 0.6 }}
        />
      </svg>
      <span className={`absolute text-xs font-bold ${urgent ? "text-rose-600" : "text-gray-700"}`}>
        {label}
      </span>
    </div>
  );
}
