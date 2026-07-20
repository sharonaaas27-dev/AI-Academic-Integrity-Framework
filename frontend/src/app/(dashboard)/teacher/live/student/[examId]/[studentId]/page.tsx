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
  Users,
  Activity,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";

const EVENT_ICONS: Record<string, string> = {
  window_blur: "Lost Focus",
  window_focus: "Regained Focus",
  fullscreen_exit: "Exited Fullscreen",
  devtools_open: "DevTools Opened",
  tab_hidden: "Tab Hidden",
  alt_tab: "Alt+Tab",
  key_paste: "Pasted Content",
  key_copy: "Copied Content",
  mouse_idle: "Mouse Idle",
  network_disconnect: "Network Lost",
};

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
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <p className="text-gray-600">Failed to load student data</p>
      </div>
    );
  }

  const { student, enrollment, answers, events, risk_reports } = data;
  const latestRisk = risk_reports?.[0];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => router.push(`/teacher/live/${examId}`)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Live Dashboard
      </button>

      {/* Student Header */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">{student.name}</h1>
            <p className="text-sm text-gray-500">{student.email}</p>
          </div>
          {latestRisk && (
            <div
              className={`text-center px-4 py-2 rounded-lg border min-w-[140px] ${
                latestRisk.risk_level === "critical" || latestRisk.risk_level === "high"
                  ? "bg-red-50 border-red-200"
                  : latestRisk.risk_level === "medium"
                    ? "bg-orange-50 border-orange-200"
                    : "bg-green-50 border-green-200"
              }`}
            >
              <p className="text-xs text-gray-500">Risk Score</p>
              <p className="text-2xl font-bold">{latestRisk.overall_score}</p>
              <p className="text-xs font-medium capitalize">{latestRisk.risk_level}</p>
              {risk_reports.length > 1 && (
                <div className="h-8 mt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={risk_reports.slice().reverse()}>
                      <Line
                        type="monotone"
                        dataKey="overall_score"
                        stroke={latestRisk.overall_score > 40 ? "#ef4444" : latestRisk.overall_score > 20 ? "#f59e0b" : "#22c55e"}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Status</p>
            <p className="font-medium capitalize">{enrollment.status}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Score</p>
            <p className="font-medium">
              {enrollment.score !== null
                ? `${enrollment.score}/${enrollment.total_marks} (${enrollment.percentage}%)`
                : "—"}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Time Taken</p>
            <p className="font-medium">
              {enrollment.time_taken_seconds
                ? `${Math.floor(enrollment.time_taken_seconds / 60)}m ${enrollment.time_taken_seconds % 60}s`
                : "—"}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Questions</p>
            <p className="font-medium">
              {answers.filter((a: any) => a.answer_text).length}/{answers.length} answered
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Reports */}
        <div className="bg-white rounded-xl shadow-sm border p-6 lg:col-span-2">
          <h2 className="font-semibold mb-4">Risk Analysis</h2>
          {risk_reports?.length > 0 ? (
            <>
              <div className="h-64 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...risk_reports].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="generated_at"
                      tickFormatter={(v: string) => v ? new Date(v).toLocaleTimeString() : ""}
                      stroke="#9ca3af"
                      fontSize={11}
                    />
                    <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={11} />
                    <Tooltip
                      formatter={(value: number) => [`${value}`, "Risk Score"]}
                      labelFormatter={(label: string) => label ? new Date(label).toLocaleTimeString() : ""}
                    />
                    <defs>
                      <linearGradient id="riskLineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>
                    <Line
                      type="monotone"
                      dataKey="overall_score"
                      stroke="url(#riskLineGrad)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#fff", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {risk_reports.map((r: any, i: number) => (
                  <div key={i} className="p-2 border rounded-lg text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">
                        Score: {r.overall_score} —{" "}
                        <span className="capitalize">{r.risk_level}</span>
                      </span>
                      <span className="text-gray-500">
                        {r.generated_at ? new Date(r.generated_at).toLocaleTimeString() : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-gray-600">
                      <div>Rules: {r.rule_score}</div>
                      <div>ML: {r.ml_score}</div>
                      <div>Context: {r.context_score}</div>
                    </div>
                    {r.rule_triggers && r.rule_triggers.length > 0 && (
                      <div className="mt-1 text-red-600">
                        {r.rule_triggers.map((t: any, j: number) => (
                          <div key={j}>• {t.rule_name || t}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">
              No risk reports generated yet
            </p>
          )}
        </div>

        {/* Behavior Events */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="font-semibold mb-4">Recent Behavior Events</h2>
          {events?.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {events.map((e: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 border rounded-lg text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-gray-400" />
                    <span>
                      {EVENT_ICONS[e.event_type] || e.event_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {Math.round((Date.now() / 1000 - e.server_timestamp) / 60)}m ago
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">
              No behavior events recorded
            </p>
          )}
        </div>

        {/* Answers */}
        <div className="bg-white rounded-xl shadow-sm border p-6 lg:col-span-2">
          <h2 className="font-semibold mb-4">Answers</h2>
          {answers?.length > 0 ? (
            <div className="space-y-3">
              {answers.map((a: any, i: number) => (
                <div
                  key={i}
                  className={`p-3 border rounded-lg ${
                    a.is_correct === true
                      ? "border-green-200 bg-green-50"
                      : a.is_correct === false
                        ? "border-red-200 bg-red-50"
                        : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      Q{i + 1}: {a.question_text}
                    </span>
                    {a.is_correct !== null && (
                      <span className="text-xs font-medium">
                        {a.is_correct ? "✓ Correct" : "✗ Incorrect"}
                        {a.marks_obtained !== null && ` (${a.marks_obtained} marks)`}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">
                    Answer: {a.answer_text || <span className="text-gray-400 italic">No answer</span>}
                  </p>
                  {a.edit_count > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Edited {a.edit_count} time{a.edit_count > 1 ? "s" : ""}
                      {a.time_spent_seconds
                        ? ` · ${a.time_spent_seconds}s spent`
                        : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-8">
              No answers submitted yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
