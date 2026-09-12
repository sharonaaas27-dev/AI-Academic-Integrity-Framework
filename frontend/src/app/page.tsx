"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Eye, Brain, BarChart3, ArrowRight, MousePointer2, Keyboard, ScanEye } from "lucide-react";
import { HeroScene } from "@/components/illustrations/scenes";
import { CountUp } from "@/components/ui/CountUp";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="bg-campus-plain min-h-screen">
      <header className="sticky top-0 z-10 border-b-2 border-amber-100 bg-white/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-1.5">
              <Shield className="h-5 w-5 text-white" />
            </span>
            <span className="text-lg font-extrabold text-gray-900">
              AI Academic Integrity
            </span>
          </div>
          <button
            onClick={() => router.push("/login")}
            className="group flex items-center gap-1.5 rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white transition-transform hover:scale-105"
          >
            Sign In
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="hero-blob absolute inset-0 opacity-60 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block rounded-full border-2 border-teal-200 bg-teal-50 px-4 py-1 text-xs font-bold uppercase tracking-wide text-teal-700">
                No webcam needed
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight text-gray-900 md:text-6xl">
                Happy exams,
                <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent"> honest results</span>
              </h1>
              <p className="mt-5 text-lg text-gray-600">
                Instead of webcam surveillance, we watch behavior — mouse,
                keys, focus — and give human invigilators a risk score with
                evidence. We never automatically accuse students.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => router.push("/login")}
                  className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-7 py-3 font-bold text-white shadow-lg shadow-orange-200 transition-transform hover:scale-105"
                >
                  Sign In to begin
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
                <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                  <ScanEye className="h-4 w-4 text-teal-600" />
                  Privacy-first behavioral logs
                </div>
              </div>
              {/* live stat strip */}
              <div className="mt-10 grid max-w-md grid-cols-3 gap-4">
                {[
                  { v: 19, suffix: "", label: "Behavior signals" },
                  { v: 3, suffix: "", label: "AI models" },
                  { v: 100, suffix: "%", label: "Explainable" },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border-2 border-amber-100 bg-white/80 p-3 text-center shadow-sm">
                    <p className="text-2xl font-extrabold text-gray-900">
                      <CountUp value={s.v} suffix={s.suffix} />
                    </p>
                    <p className="text-xs font-medium text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15 }}
            >
              <HeroScene className="mx-auto max-w-md drop-shadow-xl" />
            </motion.div>
          </div>
          {/* wave divider */}
          <svg viewBox="0 0 1440 70" className="block w-full text-white" preserveAspectRatio="none" aria-hidden>
            <path d="M0,40 C240,80 480,0 720,30 C960,60 1200,10 1440,40 L1440,70 L0,70 Z" fill="currentColor" />
          </svg>
        </section>

        {/* How it works strip */}
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold text-gray-600"
            >
              {[
                { icon: MousePointer2, t: "Mouse moves tracked" },
                { icon: Keyboard, t: "Typing rhythm analyzed" },
                { icon: Eye, t: "Focus loss detected" },
              ].map((s, i) => (
                <motion.span
                  key={s.t}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className="flex items-center gap-2 rounded-full border-2 border-amber-100 bg-amber-50 px-4 py-2"
                >
                  <s.icon className="h-4 w-4 text-orange-500" />
                  {s.t}
                </motion.span>
              ))}
            </motion.div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {features.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  whileHover={{ y: -8, rotate: i === 1 ? 1 : -1 }}
                  className="rounded-3xl border-2 border-amber-100 bg-gradient-to-b from-white to-amber-50/60 p-7 shadow-sm hover:shadow-xl"
                >
                  <motion.div
                    whileHover={{ rotate: [0, -12, 12, 0] }}
                    transition={{ duration: 0.5 }}
                    className={`mb-4 w-fit rounded-2xl bg-gradient-to-br ${feature.bg} p-3`}
                  >
                    <feature.icon className="h-7 w-7 text-white" />
                  </motion.div>
                  <h3 className="mb-2 text-lg font-extrabold text-gray-900">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* footer */}
        <footer className="bg-gray-900 py-8 text-center text-sm text-gray-400">
          <p className="font-semibold text-white">AI Academic Integrity Framework</p>
          <p className="mt-1">Fair proctoring through behavior — evidence for humans, never auto-accusations.</p>
        </footer>
      </main>
    </div>
  );
}

const features = [
  {
    title: "Behavior Analysis SDK",
    description:
      "JavaScript SDK that captures mouse movements, keyboard patterns, focus events, and more — all privacy-first without webcam.",
    icon: Eye,
    bg: "from-teal-400 to-emerald-500",
  },
  {
    title: "AI Risk Engine",
    description:
      "Ensemble of Isolation Forest, Random Forest, and XGBoost models combined with configurable rules for accurate risk scoring.",
    icon: Brain,
    bg: "from-amber-400 to-orange-500",
  },
  {
    title: "Explainable Analytics",
    description:
      "Every risk score comes with human-readable explanations, evidence timeline, and confidence metrics for informed invigilation.",
    icon: BarChart3,
    bg: "from-rose-400 to-pink-500",
  },
];
