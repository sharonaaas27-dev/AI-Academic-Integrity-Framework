"use client";

import { motion } from "framer-motion";

/** Friendly owl mascot — the face of campus integrity. */
export function OwlMascot({
  className = "h-24 w-24",
  wave = false,
}: {
  className?: string;
  wave?: boolean;
}) {
  return (
    <motion.svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Owl mascot"
      animate={wave ? { rotate: [0, -6, 6, 0] } : undefined}
      transition={wave ? { duration: 2.5, repeat: Infinity } : undefined}
    >
      {/* wings */}
      <ellipse cx="18" cy="72" rx="10" ry="20" fill="#f59e0b" />
      <ellipse cx="102" cy="72" rx="10" ry="20" fill="#f59e0b" />
      {/* body */}
      <ellipse cx="60" cy="66" rx="42" ry="46" fill="#fbbf24" />
      <ellipse cx="60" cy="78" rx="28" ry="28" fill="#fef3c7" />
      {/* graduation cap */}
      <rect x="34" y="8" width="52" height="10" rx="2" fill="#0f766e" transform="rotate(-6 60 13)" />
      <rect x="56" y="14" width="8" height="16" fill="#0f766e" transform="rotate(-6 60 13)" />
      <circle cx="64" cy="32" r="3" fill="#f43f5e" />
      {/* eyes */}
      <circle cx="44" cy="56" r="13" fill="#fff" />
      <circle cx="76" cy="56" r="13" fill="#fff" />
      <circle cx="46" cy="58" r="5" fill="#1e293b" />
      <circle cx="74" cy="58" r="5" fill="#1e293b" />
      <circle cx="48" cy="56" r="1.8" fill="#fff" />
      <circle cx="76" cy="56" r="1.8" fill="#fff" />
      {/* beak */}
      <polygon points="60,66 53,74 67,74" fill="#f97316" />
      {/* feet */}
      <ellipse cx="46" cy="110" rx="8" ry="5" fill="#f97316" />
      <ellipse cx="74" cy="110" rx="8" ry="5" fill="#f97316" />
      {/* belly feathers */}
      <path d="M48 88 q4 5 8 0 q4 5 8 0 q4 5 8 0" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </motion.svg>
  );
}
