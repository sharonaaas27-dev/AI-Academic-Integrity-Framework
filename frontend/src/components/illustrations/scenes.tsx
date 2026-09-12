"use client";

import { motion } from "framer-motion";
import { OwlMascot } from "./OwlMascot";

function Float({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 5, repeat: Infinity, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Landing hero: owl at a desk with floating grade badges. */
export function HeroScene({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`} aria-hidden>
      <div className="hero-blob absolute inset-0 blur-2xl" />
      <svg viewBox="0 0 400 260" className="relative w-full h-auto">
        {/* sun */}
        <circle cx="340" cy="40" r="26" fill="#fde68a" />
        <circle cx="340" cy="40" r="34" fill="#fde68a" opacity="0.35" />
        {/* books stack */}
        <rect x="30" y="190" width="90" height="18" rx="4" fill="#14b8a6" />
        <rect x="38" y="172" width="76" height="18" rx="4" fill="#f43f5e" />
        <rect x="30" y="154" width="90" height="18" rx="4" fill="#6366f1" />
        {/* desk */}
        <rect x="140" y="196" width="230" height="14" rx="7" fill="#b45309" />
        <rect x="160" y="210" width="12" height="40" fill="#92400e" />
        <rect x="338" y="210" width="12" height="40" fill="#92400e" />
        {/* exam paper */}
        <rect x="220" y="140" width="70" height="56" rx="4" fill="#fff" stroke="#e2e8f0" strokeWidth="2" />
        <line x1="230" y1="152" x2="280" y2="152" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <line x1="230" y1="164" x2="272" y2="164" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
        <path d="M262 176 l6 6 12 -14" stroke="#22c55e" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* pencil */}
        <rect x="300" y="150" width="10" height="52" rx="3" fill="#f59e0b" transform="rotate(18 305 176)" />
        <polygon points="308,202 302,214 296,202" fill="#fcd34d" />
        <polygon points="304,208 302,214 300,208" fill="#1e293b" />
      </svg>
      <div className="absolute -top-2 left-6">
        <Float>
          <span className="inline-block rounded-full bg-white px-3 py-1 text-sm font-bold text-green-600 shadow-md border">A+</span>
        </Float>
      </div>
      <div className="absolute top-10 right-4">
        <Float delay={1.2}>
          <span className="inline-block rounded-full bg-white px-3 py-1 text-sm font-bold text-teal-600 shadow-md border">100%</span>
        </Float>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <OwlMascot className="h-28 w-28 drop-shadow-lg" wave />
      </div>
    </div>
  );
}

/** Auth side panel art. */
export function AuthSideArt() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-8 text-white">
      <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/20" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/15" />
      <Float>
        <OwlMascot className="h-36 w-36 drop-shadow-xl" wave />
      </Float>
      <p className="relative mt-6 text-center text-2xl font-bold leading-snug">
        Exams you can trust,
        <br />
        students you respect.
      </p>
      <p className="relative mt-3 max-w-xs text-center text-sm text-white/90">
        Privacy-first behavioral insights — no webcam, no accusations, just evidence for humans.
      </p>
      <div className="relative mt-6 flex gap-2">
        {["Mouse", "Keys", "Focus"].map((t, i) => (
          <Float key={t} delay={i * 0.8}>
            <span className="rounded-full bg-white/25 px-3 py-1 text-xs font-semibold backdrop-blur">{t}</span>
          </Float>
        ))}
      </div>
    </div>
  );
}

/** Small generic empty-state scenes. */
function EmptyBase({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <Float>
      <svg viewBox="0 0 200 140" className={`h-32 w-32 ${className}`} aria-hidden>
        {children}
      </svg>
    </Float>
  );
}

export function EmptyExams() {
  return (
    <EmptyBase>
      <rect x="60" y="30" width="80" height="90" rx="8" fill="#fff" stroke="#e2e8f0" strokeWidth="3" />
      <line x1="75" y1="50" x2="125" y2="50" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
      <line x1="75" y1="66" x2="125" y2="66" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
      <line x1="75" y1="82" x2="110" y2="82" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
      <circle cx="150" cy="100" r="20" fill="#14b8a6" />
      <path d="M141 100 l6 6 12 -14" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </EmptyBase>
  );
}

export function EmptyStudents() {
  return (
    <EmptyBase>
      <circle cx="80" cy="55" r="20" fill="#fde68a" />
      <circle cx="125" cy="60" r="16" fill="#a7f3d0" />
      <rect x="45" y="85" width="110" height="14" rx="7" fill="#f59e0b" />
      <rect x="60" y="103" width="80" height="10" rx="5" fill="#e2e8f0" />
    </EmptyBase>
  );
}

export function EmptyAlerts() {
  return (
    <EmptyBase>
      <path d="M100 20 L160 110 H40 Z" fill="#fef3c7" stroke="#f59e0b" strokeWidth="4" strokeLinejoin="round" />
      <rect x="96" y="55" width="8" height="26" rx="4" fill="#f59e0b" />
      <circle cx="100" cy="92" r="5" fill="#f59e0b" />
    </EmptyBase>
  );
}

export function EmptyQuestions() {
  return (
    <EmptyBase>
      <rect x="55" y="25" width="90" height="100" rx="8" fill="#fff" stroke="#e2e8f0" strokeWidth="3" />
      <text x="100" y="85" textAnchor="middle" fontSize="44" fontWeight="bold" fill="#cbd5e1">?</text>
      <circle cx="150" cy="40" r="16" fill="#fda4af" />
      <rect x="143" y="33" width="14" height="4" rx="2" fill="#fff" />
      <rect x="148" y="28" width="4" height="14" rx="2" fill="#fff" />
    </EmptyBase>
  );
}
