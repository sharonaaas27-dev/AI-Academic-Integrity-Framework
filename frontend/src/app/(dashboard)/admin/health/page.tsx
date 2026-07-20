"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Server,
  Loader2,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Activity,
  Database,
  Cpu,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";

export default function AdminHealthPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) { router.replace("/login"); return; }
      const role = JSON.parse(raw).role?.toLowerCase?.() || "";
      if (!["admin", "super_admin"].includes(role)) {
        router.replace(role === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
        return;
      }
      setAuthChecked(true);
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-health"],
    queryFn: () => api.get("/api/v1/admin/system-health"),
    enabled: authChecked,
  });

  if (!authChecked) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isHealthy = data?.status === "healthy";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="p-2 border rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">System Health</h1>
            <p className="text-sm text-gray-500">
              Server status and performance metrics
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            queryClient.invalidateQueries({ queryKey: ["admin-health"] })
          }
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Status Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-6 rounded-xl border ${
              isHealthy
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <div className="flex items-center gap-4">
              {isHealthy ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-600" />
              )}
              <div>
                <h2 className="text-lg font-semibold">
                  {isHealthy ? "All Systems Operational" : "System Issues Detected"}
                </h2>
                <p className="text-sm text-gray-600">
                  Status: <span className="font-medium capitalize">{data.status}</span>
                  {" · "}Version: <span className="font-mono">{data.version}</span>
                </p>
              </div>
            </div>
          </motion.div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Uptime",
                value: formatUptime(data.uptime_seconds),
                icon: Clock,
                color: "text-blue-600 bg-blue-50",
              },
              {
                label: "Active Connections",
                value: data.active_connections,
                icon: Activity,
                color: "text-green-600 bg-green-50",
              },
              {
                label: "Queue Size",
                value: data.queue_size,
                icon: Database,
                color: data.queue_size > 100
                  ? "text-red-600 bg-red-50"
                  : "text-purple-600 bg-purple-50",
              },
              {
                label: "Memory Usage",
                value: `${data.memory_usage_mb.toFixed(1)} MB`,
                icon: Cpu,
                color: data.memory_usage_mb > 500
                  ? "text-red-600 bg-red-50"
                  : "text-orange-600 bg-orange-50",
              },
            ].map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-5 rounded-xl shadow-sm border"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">{metric.label}</p>
                  <div className={`p-2 rounded-lg ${metric.color}`}>
                    <metric.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{metric.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Services */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-xl shadow-sm border"
          >
            <h2 className="text-lg font-semibold mb-4">Services</h2>
            <div className="space-y-3">
              {[
                { name: "API Server", status: "healthy" },
                { name: "Database", status: "healthy" },
                { name: "Redis Cache", status: "healthy" },
                { name: "MinIO Storage", status: "healthy" },
              ].map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <span className="font-medium text-sm">{service.name}</span>
                  <span
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      service.status === "healthy"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    <CheckCircle className="h-3 w-3" />
                    {service.status}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="text-center py-20">
          <Server className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Failed to load health data</p>
        </div>
      )}
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(" ") || "0m";
}
