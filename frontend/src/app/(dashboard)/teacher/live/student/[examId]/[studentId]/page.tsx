"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trophy,
  ListChecks,
  ShieldAlert,
  MousePointerClick,
  Eye,
  Copy,
  ClipboardPaste,
  Maximize2,
  WifiOff,
  Globe,
  Keyboard,
  Hourglass,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyAlerts, EmptyExams } from "@/components/illustrations/scenes";

const EVENT_META: Record<string, { label: string; icon: any; cls: string }> = {
  window_blur: { label: "Lost Focus", icon: Eye, cls: "bg-amber-100 text-amber-700" },
  window_focus: { label: "Regained Focus", icon: Eye, cls: "bg-emerald-100 text-emerald-700" },
  fullscreen_exit: { label: "Exited Fullscreen", icon: Maximize2, cls: "bg-orange-100 text-orange-700" },
  devtools_open: { label: "DevTools Opened", icon: AlertTriangle, cls: "bg-rose-100 text-rose-700" },
  tab_hidden: { label: "Tab Hidden", icon: Globe, cls: "bg-amber-100 text-amber-700" },
  alt_tab: { label: "Alt+Tab", icon: Globe, cls: "bg-amber-100 text-amber-700" },
  key_paste: { label: "Pasted Content", icon: ClipboardPaste, cls: "bg-rose-100 text-rose-700" },
  key_copy: { label: "Copied Content", icon: Copy, cls: "bg-orange-100 text-orange-700" },
  mouse_idle: { label: "Mouse Idle", icon: MousePointerClick, cls: "bg-sky-100 text-sky-700" },
  network_disconnect: { label: "Network Lost", icon: WifiOff, cls: "bg-rose-100 text-rose-700" },
  refresh: { label: "Page Refresh", icon: Globe, cls: "bg-orange-100 text-orange-700" },
  navigation: { label: "Navigated", icon: Globe, cls: "bg-amber-100 text-amber-700" },
};

function eventMeta(type: string) {
  return EVENT_META[type] || { label: type.replace(/_/g, " "), icon: Keyboard, cls: "bg-gray-100 text-gray-600" };
}

export default function StudentLiveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;
  const studentId = params.studentId as string;

  const { data, isLoading } = useQuery({
    queryKey: ["live-student-detail", examId, studentId],
    queryFn: () =>
      api.get(`/api/v1/teachers/live/${examId}/students/${studentId}`),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="bg-campus min-h-screen">
        <div className="mx-auto grid max-w-5xl gap-6 p-6">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={5} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CardSkeleton lines={4} />
            <CardSkeleton lines={4} />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-campus min-h-screen p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
        <p className="font-medium text-gray-600">Failed to load student data</p>
      </div>
    );
  }

  const { student, enrollment, answers, events, risk_reports } = data;
  const latestRisk = risk_reports?.[0];
  const riskColor =
    latestRisk?.risk_level === "critical" || latestRisk?.risk_level === "high"
      ? "from-rose-400 to-orange-400"
      : latestRisk?.risk_level === "medium"
        ? "from-amber-400 to-orange-400"
        : "from-emerald-400 to-teal-500";

  return (
    <div className="bg-campus min-h-screen">
      <div className="mx-auto max-w-5xl p-6">
        <motion.button
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.push(`/teacher/live/${examId}`)}
          className="mb-6 flex items-center gap-2 rounded-full border-2 border-amber-200 bg-white px-4 py-1.5 text-sm font-bold text-gray-600 transition-all hover:border-orange-300 hover:text-orange-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Live Dashboard
        </motion.button>

        {/* Student Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${riskColor} text-xl font-extrabold text-white shadow-md`}>
                {(student.name || "?")[0].toUpperCase()}
              </span>
              <div>
                <h1 className="text-xl font-extrabold text-gray-900">{student.name}</h1>
                <p className="text-sm text-gray-500">{student.email}</p>
              </div>
            </div>
            {latestRisk && (
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className={`min-w-[150px] rounded-2xl border-2 px-4 py-2 text-center ${
                  latestRisk.risk_level === "critical" || latestRisk.risk_level === "high"
                    ? "border-rose-300 bg-rose-50"
                    : latestRisk.risk_level === "medium"
                      ? "border-orange-300 bg-orange-50"
                      : "border-emerald-300 bg-emerald-50"
                }`}
              >
                <p className="flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Risk Score
                </p>
                <p className="text-3xl font-extrabold text-gray-900">{latestRisk.overall_score}</p>
                <p className="text-xs font-bold capitalize text-gray-600">{latestRisk.risk_level}</p>
                {risk_reports.length > 1 && (
                  <div className="mt-1 h-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={risk_reports.slice().reverse()}>
                        <Line
                          type="monotone"
                          dataKey="overall_score"
                          stroke={latestRisk.overall_score > 40 ? "#f43f5e" : latestRisk.overall_score > 20 ? "#f59e0b" : "#10b981"}
                          strokeWidth={2.5}
                          dot={false}
                          isAnimationActive
                          animationDuration={600}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            {[
              { label: "Status", v: enrollment.status, cap: true },
              { label: "Score", v: enrollment.score !== null ? `${enrollment.score}/${enrollment.total_marks} (${enrollment.percentage}%)` : "—" },
              { label: "Time Taken", v: enrollment.time_taken_seconds ? `${Math.floor(enrollment.time_taken_seconds / 60)}m ${enrollment.time_taken_seconds % 60}s` : "—" },
              { label: "Questions", v: `${answers.filter((a: any) => a.answer_text).length}/${answers.length} answered` },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{m.label}</p>
                <p className={`mt-0.5 font-bold text-gray-900 ${m.cap ? "capitalize" : ""}`}>{m.v}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Risk Reports */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm lg:col-span-2"
          >
            <h2 className="mb-4 flex items-center gap-2 font-extrabold text-gray-900">
              <Hourglass className="h-5 w-5 text-orange-500" />
              Risk Analysis Journey
            </h2>
            {risk_reports?.length > 0 ? (
              <>
                <div className="mb-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...risk_reports].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#fde68a" />
                      <XAxis
                        dataKey="generated_at"
                        tickFormatter={(v: string) => v ? new Date(v).toLocaleTimeString() : ""}
                        stroke="#9ca3af"
                        fontSize={11}
                      />
                      <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={11} />
                      <Tooltip
                        contentStyle={{ borderRadius: 14, border: "2px solid #fed7aa", fontSize: 12 }}
                        formatter={(value: number) => [`${value}`, "Risk Score"]}
                        labelFormatter={(label: string) => label ? new Date(label).toLocaleTimeString() : ""}
                      />
                      <defs>
                        <linearGradient id="riskLineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="50%" stopColor="#f59e0b" />
                          <stop offset="100%" stopColor="#f43f5e" />
                        </linearGradient>
                      </defs>
                      <Line
                        type="monotone"
                        dataKey="overall_score"
                        stroke="url(#riskLineGrad)"
                        strokeWidth={3}
                        dot={{ r: 3.5, fill: "#fff", strokeWidth: 2, stroke: "#f59e0b" }}
                        activeDot={{ r: 6 }}
                        isAnimationActive
                        animationDuration={900}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {risk_reports.map((r: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.05, 0.4) }}
                      className="rounded-2xl border-2 border-amber-100 p-2.5 text-xs"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-bold text-gray-900">
                          Score: {r.overall_score} —{" "}
                          <span className="capitalize">{r.risk_level}</span>
                        </span>
                        <span className="font-medium text-gray-400">
                          {r.generated_at ? new Date(r.generated_at).toLocaleTimeString() : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 font-medium text-gray-600">
                        <div className="rounded-lg bg-amber-50 px-2 py-1">Rules: {r.rule_score}</div>
                        <div className="rounded-lg bg-sky-50 px-2 py-1">ML: {r.ml_score}</div>
                        <div className="rounded-lg bg-violet-50 px-2 py-1">Context: {r.context_score}</div>
                      </div>
                      {r.rule_triggers && r.rule_triggers.length > 0 && (
                        <div className="mt-1 font-semibold text-rose-600">
                          {r.rule_triggers.map((t: any, j: number) => (
                            <div key={j}>• {t.rule_name || t}</div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState art={<EmptyAlerts />} title="No risk reports yet" hint="Scores appear as behavior flows in" />
            )}
          </motion.div>

          {/* Behavior Events */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 flex items-center gap-2 font-extrabold text-gray-900">
              <MousePointerClick className="h-5 w-5 text-teal-600" />
              Behavior Timeline
            </h2>
            {events?.length > 0 ? (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {events.map((e: any, i: number) => {
                  const meta = eventMeta(e.event_type);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.5) }}
                      className="flex items-center justify-between gap-2 rounded-2xl border border-amber-100 bg-amber-50/40 p-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`rounded-lg p-1.5 ${meta.cls}`}>
                          <meta.icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="truncate font-semibold text-gray-800">{meta.label}</span>
                      </div>
                      <span className="flex-shrink-0 text-xs font-medium text-gray-400">
                        {(() => {
                          const tsMs = e.client_timestamp ?? (e.server_timestamp ? e.server_timestamp * 1000 : Date.now());
                          return `${Math.max(0, Math.round((Date.now() - tsMs) / 60000))}m ago`;
                        })()}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <EmptyState art={<EmptyAlerts />} title="No events recorded" hint="Behavior shows up live during the exam" />
            )}
          </motion.div>

          {/* Answers */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm lg:col-span-2"
          >
            <h2 className="mb-4 flex items-center gap-2 font-extrabold text-gray-900">
              <ListChecks className="h-5 w-5 text-violet-500" />
              Answers
            </h2>
            {answers?.length > 0 ? (
              <div className="space-y-3">
                {answers.map((a: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    className={`rounded-2xl border-2 p-3 ${
                      a.is_correct === true
                        ? "border-emerald-300 bg-emerald-50/70"
                        : a.is_correct === false
                          ? "border-rose-200 bg-rose-50/70"
                          : "border-amber-100"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">
                        Q{i + 1}: {a.question_text}
                      </span>
                      {a.is_correct !== null && a.is_correct !== undefined && (
                        <span className={`flex items-center gap-1 text-xs font-extrabold ${a.is_correct ? "text-emerald-600" : "text-rose-500"}`}>
                          {a.is_correct ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                          {a.is_correct ? "Correct" : "Incorrect"}
                          {a.marks_obtained !== null && a.marks_obtained !== undefined && ` (${a.marks_obtained} marks)`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700">
                      Answer: {a.answer_text || <span className="italic text-gray-400">No answer</span>}
                    </p>
                    {a.edit_count > 0 && (
                      <p className="mt-1 text-xs font-medium text-gray-400">
                        Edited {a.edit_count} time{a.edit_count > 1 ? "s" : ""}
                        {a.time_spent_seconds ? ` · ${a.time_spent_seconds}s spent` : ""}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState art={<EmptyExams />} title="No answers yet" hint="Answers appear once the student responds" />
            )}
          </motion.div>

          {/* status strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-4 text-sm font-medium text-gray-400 lg:col-span-2"
          >
            <span className="flex items-center gap-1.5">
              {enrollment.status === "completed" ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-amber-500" />}
              {enrollment.status}
            </span>
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-amber-500" />
              {enrollment.percentage !== null && enrollment.percentage !== undefined ? `${enrollment.percentage}%` : "Ungraded"}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
