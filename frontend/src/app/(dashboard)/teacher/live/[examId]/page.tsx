"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Eye,
  Shield,
  Activity,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { api } from "@/lib/api";
import { toast } from "sonner";

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
      case "completed": return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "active": return <Activity className="h-4 w-4 text-blue-600" />;
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/teacher/dashboard")}
            className="p-2 border rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{exam?.title || "Live Monitoring"}</h1>
            <p className="text-sm text-gray-500">
              Auto-refreshes every 5s
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPollKey((k) => k + 1);
              toast.success("Refreshed");
            }}
            className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
          <Shield className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Total Enrolled", value: summary.total_enrolled, icon: Users, color: "text-blue-600 bg-blue-50" },
            { label: "Not Started", value: summary.not_started, icon: Clock, color: "text-gray-600 bg-gray-50" },
            { label: "In Progress", value: summary.active, icon: Activity, color: "text-blue-600 bg-blue-100" },
            { label: "Submitted", value: summary.completed, icon: CheckCircle, color: "text-green-600 bg-green-50" },
            { label: "Alerts (5m)", value: summary.recent_alerts_5min, icon: AlertTriangle, color: "text-red-600 bg-red-50" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white p-4 rounded-xl shadow-sm border"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-2xl font-bold mt-0.5">{s.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Recent Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <h2 className="font-semibold text-sm">Recent Alerts</h2>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.slice(0, 10).map((alert: any) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded-lg text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{alert.student_name}</span>
                  <span className="text-xs text-red-600">{alert.event_type.replace(/_/g, " ")}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {Math.round((Date.now() / 1000 - alert.timestamp) / 60)}m ago
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student Grid */}
      <h2 className="text-lg font-semibold mb-3">Students</h2>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : students?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((s: any, i: number) => (
            <motion.div
              key={s.student_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`bg-white rounded-xl shadow-sm border p-4 ${
                s.risk_level === "critical" || s.risk_level === "high"
                  ? "border-red-300 ring-1 ring-red-200"
                  : s.risk_level === "medium"
                    ? "border-orange-200"
                    : ""
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {statusIcon(s.status)}
                  <div>
                    <p className="font-medium text-sm">{s.student_name}</p>
                    <p className="text-xs text-gray-500">{s.student_email}</p>
                  </div>
                </div>
                {s.risk_level && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      RISK_COLORS[s.risk_level] || "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {s.risk_level}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
                <div>
                  <span className="text-gray-400">Status:</span>{" "}
                  <span className="font-medium">{statusLabel(s.status)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Progress:</span>{" "}
                  <span className="font-medium">
                    {s.answered_count}/{s.total_questions}
                  </span>
                </div>
                {s.time_taken_seconds && (
                  <div>
                    <span className="text-gray-400">Time:</span>{" "}
                    <span className="font-medium">
                      {Math.floor(s.time_taken_seconds / 60)}m
                    </span>
                  </div>
                )}
                {s.risk_score !== null && (
                  <div>
                    <span className="text-gray-400">Risk:</span>{" "}
                    <span className="font-medium">{s.risk_score}</span>
                  </div>
                )}
              </div>

              {s.risk_score_history?.length > 1 && (
                <div className="h-10 mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={s.risk_score_history}>
                      <defs>
                        <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke={s.risk_score > 40 ? "#ef4444" : s.risk_score > 20 ? "#f59e0b" : "#22c55e"}
                        fill="url(#riskGrad)"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <button
                onClick={() =>
                  router.push(`/teacher/live/student/${examId}/${s.student_id}`)
                }
                className="flex items-center justify-center gap-1 w-full py-1.5 text-xs border rounded-lg hover:bg-gray-50"
              >
                <Eye className="h-3 w-3" />
                View Details
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No students enrolled yet</p>
        </div>
      )}
    </div>
  );
}
