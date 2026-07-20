"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, Eye, Brain, BarChart3 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg">
              AI Academic Integrity
            </span>
          </div>
          <button
            onClick={() => router.push("/login")}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Sign In
          </button>
        </div>
      </header>

      <main>
        <section className="max-w-7xl mx-auto px-4 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Privacy-First AI Behavioral Monitoring
              <span className="text-primary"> for Online Examinations</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Instead of webcam surveillance, detect suspicious behavior using
              behavioral logs. We never automatically accuse students — we
              calculate a risk score and provide evidence to human invigilators.
            </p>

          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20"
          >
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition-shadow"
              >
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </motion.div>
        </section>
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
  },
  {
    title: "AI Risk Engine",
    description:
      "Ensemble of Isolation Forest, Random Forest, and XGBoost models combined with configurable rules for accurate risk scoring.",
    icon: Brain,
  },
  {
    title: "Explainable Analytics",
    description:
      "Every risk score comes with human-readable explanations, evidence timeline, and confidence metrics for informed invigilation.",
    icon: BarChart3,
  },
];
