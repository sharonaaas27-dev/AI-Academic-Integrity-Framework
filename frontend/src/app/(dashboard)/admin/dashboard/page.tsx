"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Activity,
  Users,
  FileText,
  AlertTriangle,
  Shield,
  BarChart3,
  Clock,
  Server,
  Building2,
  Loader2,
  LogOut,
  UserCog,
  BookOpen,
} from "lucide-react";
import { api } from "@/lib/api";

export default function AdminDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const raw = localStorage.getItem("user");
      if (!raw) {
        router.replace("/login");
        return;
      }
      const user = JSON.parse(raw);
      const role = user.role?.toLowerCase?.() || "";
      if (!["admin", "super_admin"].includes(role)) {
        const target = role === "teacher" || role === "exam_controller"
          ? "/teacher/dashboard"
          : "/student/dashboard";
        router.replace(target);
        return;
      }
    } catch {
      router.replace("/login");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get("/api/v1/admin/dashboard"),
    enabled: authChecked,
  });

  const { data: riskOverview } = useQuery({
    queryKey: ["admin-risk-overview"],
    queryFn: () => api.get("/api/v1/admin/risk-overview"),
    enabled: authChecked,
  });

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (!authChecked) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Exams",
      value: stats?.total_exams || 0,
      icon: FileText,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Active Exams",
      value: stats?.active_exams || 0,
      icon: Activity,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Total Students",
      value: stats?.total_students || 0,
      icon: Users,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "High Risk Flags",
      value: stats?.high_risk_reports || 0,
      icon: AlertTriangle,
      color: "text-red-600 bg-red-50",
    },
    {
      label: "Events/hr",
      value: stats?.recent_events_per_hour || 0,
      icon: BarChart3,
      color: "text-orange-600 bg-orange-50",
    },
    {
      label: "Institutions",
      value: stats?.total_institutions || 0,
      icon: Shield,
      color: "text-indigo-600 bg-indigo-50",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            System-wide overview of exams, students, and risk monitoring
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-4 rounded-xl shadow-sm border"
          >
            <div className={`p-2 rounded-lg w-fit mb-3 ${stat.color}`}>
              <stat.icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold">
              {isLoading ? (
                <span className="inline-block w-12 h-6 bg-gray-200 rounded animate-pulse" />
              ) : (
                stat.value
              )}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Management Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          {
            label: "User Management",
            description: "Create, edit, and manage users",
            icon: UserCog,
            href: "/admin/users",
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Institutions",
            description: "Manage colleges and organizations",
            icon: Building2,
            href: "/admin/institutions",
            color: "text-purple-600 bg-purple-50",
          },
          {
            label: "Courses",
            description: "Manage courses across institutions",
            icon: BookOpen,
            href: "/admin/courses",
            color: "text-indigo-600 bg-indigo-50",
          },
          {
            label: "All Exams",
            description: "Browse all exams across institutions",
            icon: FileText,
            href: "/admin/exams",
            color: "text-green-600 bg-green-50",
          },
          {
            label: "System Health",
            description: "Server status and metrics",
            icon: Server,
            href: "/admin/health",
            color: "text-orange-600 bg-orange-50",
          },
        ].map((link) => (
          <button
            key={link.label}
            onClick={() => router.push(link.href)}
            className="bg-white p-4 rounded-xl shadow-sm border text-left hover:shadow-md transition-shadow"
          >
            <div className={`p-2 rounded-lg w-fit mb-3 ${link.color}`}>
              <link.icon className="h-5 w-5" />
            </div>
            <p className="font-medium">{link.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{link.description}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Risk Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Risk Distribution</h2>
          {riskOverview?.distribution ? (
            <div className="space-y-3">
              {Object.entries(riskOverview.distribution).map(
                ([level, count]: [string, any]) => {
                  const colors: Record<string, string> = {
                    safe: "bg-green-500",
                    low: "bg-yellow-500",
                    medium: "bg-orange-500",
                    high: "bg-red-500",
                    critical: "bg-red-600",
                  };
                  const total = riskOverview.total_reports || 1;
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <span className="text-sm font-medium capitalize w-20">
                        {level}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${colors[level] || "bg-gray-400"}`}
                          style={{
                            width: `${((count / total) * 100).toFixed(1)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 w-16 text-right">
                        {count}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No risk data available</p>
          )}
        </div>

        {/* Recent Flags */}
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h2 className="text-lg font-semibold mb-4">Recent High-Risk Flags</h2>
          {riskOverview?.recent_flags?.length > 0 ? (
            <div className="space-y-3">
              {riskOverview.recent_flags
                .filter((f: any) =>
                  ["high", "critical"].includes(f.level)
                )
                .slice(0, 5)
                .map((flag: any) => (
                  <div
                    key={flag.id}
                    className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-red-800">
                        Score: {flag.score.toFixed(1)}
                      </p>
                      <p className="text-xs text-red-600">
                        Level: {flag.level} | Exam: {flag.exam_id.slice(0, 8)}...
                      </p>
                    </div>
                    <span className="text-xs text-red-500">
                      {new Date(flag.generated_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No recent flags</p>
          )}
        </div>
      </div>
    </div>
  );
}
