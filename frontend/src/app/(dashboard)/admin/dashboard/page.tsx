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
  Server,
  Building2,
  Loader2,
  LogOut,
  UserCog,
  BookOpen,
  PieChart,
  Siren,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyAlerts } from "@/components/illustrations/scenes";

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

  const { data: stats } = useQuery({
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
      <div className="bg-campus flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const statCards = [
    { label: "Total Exams", value: stats?.total_exams || 0, icon: FileText, color: "blue" as const },
    { label: "Active Exams", value: stats?.active_exams || 0, icon: Activity, color: "green" as const },
    { label: "Total Students", value: stats?.total_students || 0, icon: Users, color: "purple" as const },
    { label: "High Risk Flags", value: stats?.high_risk_reports || 0, icon: AlertTriangle, color: "red" as const },
    { label: "Events/hr", value: stats?.recent_events_per_hour || 0, icon: BarChart3, color: "orange" as const },
    { label: "Institutions", value: stats?.total_institutions || 0, icon: Shield, color: "teal" as const },
  ];

  return (
    <div className="bg-campus min-h-screen">
      <div className="mx-auto max-w-7xl p-6">
        <PageHeader
          title="Mission Control"
          subtitle="System-wide exams, students, and risk monitoring"
          actions={
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-full border-2 border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-all hover:border-orange-300 hover:text-orange-600"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          }
        />

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {statCards.map((stat, i) => (
            <StatCard key={stat.label} icon={stat.icon} label={stat.label} value={stat.value} color={stat.color} index={i} />
          ))}
        </div>

        {/* Management Links */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Users", description: "Create and manage users", icon: UserCog, href: "/admin/users", bg: "from-sky-400 to-blue-500" },
            { label: "Institutions", description: "Colleges & organizations", icon: Building2, href: "/admin/institutions", bg: "from-violet-400 to-purple-500" },
            { label: "Courses", description: "Courses everywhere", icon: BookOpen, href: "/admin/courses", bg: "from-teal-400 to-emerald-500" },
            { label: "All Exams", description: "Every exam, one place", icon: FileText, href: "/admin/exams", bg: "from-amber-400 to-orange-500" },
            { label: "Health", description: "Server status & metrics", icon: Server, href: "/admin/health", bg: "from-rose-400 to-pink-500" },
          ].map((link, i) => (
            <motion.button
              key={link.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ y: -5, rotate: i % 2 ? 1 : -1 }}
              onClick={() => router.push(link.href)}
              className="rounded-3xl border-2 border-amber-100 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-lg"
            >
              <div className={`mb-3 w-fit rounded-2xl bg-gradient-to-br ${link.bg} p-2.5`}>
                <link.icon className="h-5 w-5 text-white" />
              </div>
              <p className="font-extrabold text-gray-900">{link.label}</p>
              <p className="mt-0.5 text-xs text-gray-500">{link.description}</p>
            </motion.button>
          ))}
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Risk Distribution */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-gray-900">
              <PieChart className="h-5 w-5 text-orange-500" />
              Risk Distribution
            </h2>
            {riskOverview?.distribution ? (
              <div className="space-y-3">
                {Object.entries(riskOverview.distribution).map(
                  ([level, count]: [string, any], i: number) => {
                    const colors: Record<string, string> = {
                      safe: "from-emerald-400 to-emerald-500",
                      low: "from-yellow-400 to-amber-400",
                      medium: "from-orange-400 to-orange-500",
                      high: "from-red-400 to-red-500",
                      critical: "from-red-600 to-rose-600",
                    };
                    const total = riskOverview.total_reports || 1;
                    return (
                      <div key={level} className="flex items-center gap-3">
                        <span className="w-20 text-sm font-bold capitalize text-gray-600">
                          {level}
                        </span>
                        <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-amber-50">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${((count / total) * 100).toFixed(1)}%` }}
                            transition={{ delay: 0.2 + i * 0.1, duration: 0.8, type: "spring", damping: 20 }}
                            className={`h-full rounded-full bg-gradient-to-r ${colors[level] || "from-gray-300 to-gray-400"}`}
                          />
                        </div>
                        <span className="w-16 text-right text-sm font-bold text-gray-700">
                          {count}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <EmptyState art={<EmptyAlerts />} title="No risk data yet" hint="Reports will paint this picture" />
            )}
          </motion.div>

          {/* Recent Flags */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border-2 border-rose-200 bg-gradient-to-b from-rose-50/60 to-white p-6 shadow-sm"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-gray-900">
              <Siren className="h-5 w-5 text-rose-500" />
              Recent High-Risk Flags
            </h2>
            {riskOverview?.recent_flags?.length > 0 ? (
              <div className="space-y-3">
                {riskOverview.recent_flags
                  .filter((f: any) =>
                    ["high", "critical"].includes(f.level)
                  )
                  .slice(0, 5)
                  .map((flag: any, i: number) => (
                    <motion.div
                      key={flag.id}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-center justify-between rounded-2xl border-2 border-rose-200 bg-white p-3"
                    >
                      <div>
                        <p className="text-sm font-extrabold text-gray-900">
                          Score: <span className="text-rose-600">{flag.score.toFixed(1)}</span>
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${flag.level === "critical" ? "bg-rose-500 text-white" : "bg-orange-100 text-orange-700"}`}>
                            {flag.level}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Exam: {flag.exam_id.slice(0, 8)}...
                        </p>
                      </div>
                      <span className="text-xs font-medium text-gray-400">
                        {new Date(flag.generated_at).toLocaleTimeString()}
                      </span>
                    </motion.div>
                  ))}
              </div>
            ) : (
              <EmptyState art={<EmptyAlerts />} title="No recent flags" hint="High-risk events will surface here" />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
