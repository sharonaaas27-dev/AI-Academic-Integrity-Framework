"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Shield,
  Activity,
  Radio,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "@/lib/api";
import { useLiveExam } from "@/lib/use-live";
import { toast } from "sonner";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyStudents, EmptyAlerts } from "@/components/illustrations/scenes";

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-red-50 text-red-600 border-red-200",
  medium: "bg-orange-50 text-orange-600 border-orange-200",
  low: "bg-yellow-50 text-yellow-600 border-yellow-200",
  safe: "bg-green-50 text-green-600 border-green-200",
};

export default function LiveDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const { liveConnected } = useLiveExam(examId);

  const { data: exam } = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => api.get(`/api/v1/exams/${examId}`),
  });

  const { data: summary } = useQuery({
    queryKey: ["live-summary", examId, pollKey],
    queryFn: () => api.get(`/api/v1/teachers/live/${examId}/summary`),
  });

  const { data: students, isLoading } = useQuery({
    queryKey: ["live-students", examId, pollKey],
    queryFn: () => api.get(`/api/v1/teachers/live/${examId}/students`),
  });

  const { data: alerts } = useQuery({
    queryKey: ["live-alerts", examId, pollKey],
    queryFn: () => api.get(`/api/v1/teachers/live/${examId}/alerts?minutes=10`),
  });

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setPollKey((k) => k + 1);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "active": return <Activity className="h-4 w-4 text-sky-600" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Submitted";
      case "active": return "In Progress";
      default: return "Not Started";
    }
  };

  return (
    <div className="bg-campus min-h-screen">
      <div className="mx-auto max-w-7xl p-6">
        {/* Header with LIVE badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-rose-200 bg-gradient-to-r from-rose-50 via-white to-amber-50 p-4 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/teacher/dashboard")}
              className="rounded-full border-2 border-amber-200 bg-white p-2 transition-all hover:border-orange-300"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
                {exam?.title || "Live Monitoring"}
                <span className="flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  Live
                </span>
              </h1>
              <p className="flex items-center gap-1.5 text-sm text-gray-500">
                <Radio className="h-3.5 w-3.5 text-rose-400" />
                {liveConnected ? (
                  <span className="font-bold text-emerald-600">Live push connected</span>
                ) : (
                  <>Auto-refreshes every 5s</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPollKey((k) => k + 1);
                toast.success("Refreshed");
              }}
              className="flex items-center gap-1.5 rounded-full border-2 border-amber-200 bg-white px-4 py-1.5 text-sm font-bold text-gray-600 transition-all hover:border-orange-300 hover:text-orange-600"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <span className="rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-1.5">
              <Shield className="h-5 w-5 text-white" />
            </span>
          </div>
        </motion.div>

        {/* Summary cards */}
        {summary && (
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard icon={Users} label="Enrolled" value={summary.total_enrolled} color="blue" index={0} />
            <StatCard icon={Clock} label="Not Started" value={summary.not_started} color="orange" index={1} />
            <StatCard icon={Activity} label="In Progress" value={summary.active} color="teal" index={2} />
            <StatCard icon={CheckCircle} label="Submitted" value={summary.completed} color="green" index={3} />
            <StatCard icon={AlertTriangle} label="Alerts (5m)" value={summary.recent_alerts_5min} color="red" index={4} />
          </div>
        )}

        {/* Recent Alerts */}
        {alerts && alerts.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-3xl border-2 border-rose-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
              <h2 className="text-sm font-extrabold text-gray-900">Recent Alerts</h2>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{alerts.length}</span>
            </div>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              <AnimatePresence initial={false}>
                {alerts.slice(0, 10).map((alert: any) => (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, x: -20, backgroundColor: "#fecdd3" }}
                    animate={{ opacity: 1, x: 0, backgroundColor: "#fff1f2" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center justify-between rounded-xl border border-rose-200 p-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-orange-400 text-xs font-extrabold text-white">
                        {(alert.student_name || "?")[0].toUpperCase()}
                      </span>
                      <span className="truncate font-bold text-gray-900">{alert.student_name}</span>
                      <span className="rounded-full bg-rose-200/70 px-2 py-0.5 text-xs font-semibold text-rose-700">{alert.event_type.replace(/_/g, " ")}</span>
                    </div>
                    <span className="flex-shrink-0 text-xs font-medium text-gray-500">
                      {(() => {
                        const raw = alert.timestamp_ms ?? alert.timestamp ?? (alert.server_timestamp ? alert.server_timestamp * 1000 : undefined);
                        const tsMs = typeof raw === "number" && Number.isFinite(raw) ? raw : Date.now();
                        return `${Math.max(0, Math.round((Date.now() - tsMs) / 60000))}m ago`;
                      })()}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-3xl border-2 border-emerald-200 bg-white p-4 shadow-sm"
          >
            <EmptyState art={<EmptyAlerts />} title="Quiet room — no alerts" hint="Suspicious events will pop up here live" />
          </motion.div>
        )}

        {/* Student Grid */}
        <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-gray-900">
          <Users className="h-5 w-5 text-orange-500" />
          Students
        </h2>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CardSkeleton key={i} lines={2} />
            ))}
          </div>
        ) : students?.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {students.map((s: any, i: number) => (
              <motion.div
                key={s.student_id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                whileHover={{ y: -4 }}
                className={`rounded-3xl border-2 bg-white p-4 shadow-sm transition-shadow hover:shadow-lg ${
                  s.risk_level === "critical"
                    ? "animate-pulse border-rose-400 ring-2 ring-rose-200"
                    : s.risk_level === "high"
                      ? "border-rose-300 ring-1 ring-rose-200"
                      : s.risk_level === "medium"
                        ? "border-orange-200"
                        : "border-amber-100"
                }`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-extrabold text-white">
                      {(s.student_name || "?")[0].toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-bold text-gray-900">
                        {statusIcon(s.status)}
                        {s.student_name}
                      </p>
                      <p className="truncate text-xs text-gray-500">{s.student_email}</p>
                    </div>
                  </div>
                  {s.risk_level && (
                    <span
                      className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${
                        RISK_COLORS[s.risk_level] || "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {s.risk_level}
                    </span>
                  )}
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="rounded-xl bg-amber-50/70 px-2.5 py-1.5">
                    <span className="text-gray-400">Status:</span>{" "}
                    <span className="font-bold">{statusLabel(s.status)}</span>
                  </div>
                  <div className="rounded-xl bg-amber-50/70 px-2.5 py-1.5">
                    <span className="text-gray-400">Progress:</span>{" "}
                    <span className="font-bold">
                      {s.answered_count}/{s.total_questions}
                    </span>
                  </div>
                  {s.time_taken_seconds && (
                    <div className="rounded-xl bg-amber-50/70 px-2.5 py-1.5">
                      <span className="text-gray-400">Time:</span>{" "}
                      <span className="font-bold">
                        {Math.floor(s.time_taken_seconds / 60)}m
                      </span>
                    </div>
                  )}
                  {s.risk_score !== null && s.risk_score !== undefined && (
                    <div className="rounded-xl bg-amber-50/70 px-2.5 py-1.5">
                      <span className="text-gray-400">Risk:</span>{" "}
                      <span className="font-bold">{s.risk_score}</span>
                    </div>
                  )}
                </div>

                {s.risk_score_history?.length > 1 && (
                  <div className="mb-2 h-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={s.risk_score_history}>
                        <defs>
                          <linearGradient id={`riskGrad-${s.student_id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fb923c" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#fb923c" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Tooltip
                          contentStyle={{ borderRadius: 12, fontSize: 12, border: "2px solid #fed7aa" }}
                          labelStyle={{ fontWeight: "bold" }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke={s.risk_score > 40 ? "#f43f5e" : s.risk_score > 20 ? "#f59e0b" : "#10b981"}
                          fill={`url(#riskGrad-${s.student_id})`}
                          strokeWidth={2.5}
                          dot={false}
                          isAnimationActive
                          animationDuration={800}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <button
                  onClick={() =>
                    router.push(`/teacher/live/student/${examId}/${s.student_id}`)
                  }
                  className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-amber-200 py-1.5 text-xs font-bold text-gray-600 transition-all hover:border-orange-400 hover:text-orange-600"
                >
                  <Eye className="h-3 w-3" />
                  View Details
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border-2 border-amber-100 bg-white shadow-sm">
            <EmptyState art={<EmptyStudents />} title="No students enrolled yet" hint="Enroll students to watch them live here" />
          </div>
        )}
      </div>
    </div>
  );
}
