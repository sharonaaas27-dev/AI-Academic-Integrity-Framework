"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  FileText,
  CheckCircle,
  AlertTriangle,
  GraduationCap,
  ArrowRight,
  LogOut,
  Loader2,
  PartyPopper,
  CalendarDays,
  Timer,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyExams } from "@/components/illustrations/scenes";

export default function StudentDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [userName, setUserName] = useState("");

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
      if (!["student"].includes(role)) {
        router.replace("/teacher/dashboard");
        return;
      }
      setUserName(user.first_name || user.email?.split("@")[0] || "Scholar");
    } catch {
      router.replace("/login");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const { data: exams, isLoading, isError } = useQuery({
    queryKey: ["student-exams"],
    queryFn: () => api.get("/api/v1/students/exams"),
    enabled: authChecked,
    retry: 2,
  });

  const { data: history } = useQuery({
    queryKey: ["student-history"],
    queryFn: () => api.get("/api/v1/students/history"),
    enabled: authChecked,
    retry: 2,
  });

  const avgScore =
    history?.length > 0
      ? history.reduce((s: number, h: any) => s + (h.percentage ?? 0), 0) / history.length
      : null;

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  if (!authChecked) {
    return (
      <div className="bg-campus flex h-screen items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <Loader2 className="h-8 w-8 text-orange-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-campus min-h-screen">
      <div className="mx-auto max-w-7xl p-6">
        <PageHeader
          title={`Hey ${userName}! Ready to shine?`}
          subtitle="Your upcoming exams and past victories live here"
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

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={Clock} label="Upcoming Exams" value={exams?.length || 0} color="blue" index={0} />
          <StatCard icon={CheckCircle} label="Completed" value={history?.length || 0} color="green" index={1} />
          <StatCard
            icon={GraduationCap}
            label="Average Score"
            value={avgScore !== null ? avgScore : "—"}
            decimals={avgScore !== null ? 1 : 0}
            suffix={avgScore !== null ? "%" : ""}
            color="purple"
            index={2}
          />
          <StatCard
            icon={PartyPopper}
            label="Passed"
            value={history?.filter((h: any) => (h.percentage ?? 0) >= 50).length || 0}
            color="orange"
            index={3}
          />
        </div>

        {/* Upcoming Exams */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-gray-900">
            <CalendarDays className="h-5 w-5 text-orange-500" />
            Upcoming Exams
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : isError ? (
            <div className="py-8 text-center">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-rose-400" />
              <p className="font-medium text-gray-600">Oops! Couldn&apos;t load exams</p>
              <button
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["student-exams"] })
                }
                className="mt-2 text-sm font-bold text-orange-600 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : exams?.length > 0 ? (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {exams.map((exam: any, i: number) => (
                  <motion.div
                    key={exam.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    whileHover={{ scale: 1.01 }}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-100 bg-gradient-to-r from-white to-amber-50/50 p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <span className="rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 p-2">
                        <FileText className="h-5 w-5 text-white" />
                      </span>
                      <div>
                        <p className="font-bold text-gray-900">{exam.title}</p>
                        <p className="flex items-center gap-2 text-sm text-gray-600">
                          {exam.course_name}
                          <span className="flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
                            <Timer className="h-3 w-3" />
                            {exam.duration_minutes} min
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {formatDate(exam.start_time)}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={"/student/exam/" + exam.id}
                      className="group flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-200 transition-transform hover:scale-105"
                    >
                      Join Exam
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState
              art={<EmptyExams />}
              title="No upcoming exams — enjoy the break!"
              hint="Ask your teacher to enroll you in an exam"
            />
          )}
        </motion.div>

        {/* Recent History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-gray-900">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            Recent Exam History
          </h2>
          {history?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-amber-100 text-left">
                    <th className="pb-3 font-bold text-gray-500">Exam</th>
                    <th className="pb-3 font-bold text-gray-500">Date</th>
                    <th className="pb-3 font-bold text-gray-500">Score</th>
                    <th className="pb-3 font-bold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item: any, i: number) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-amber-50 transition-colors last:border-0 hover:bg-amber-50/50"
                    >
                      <td className="py-3 font-semibold">{item.exam_title}</td>
                      <td className="py-3 text-gray-600">
                        {formatDate(item.submitted_at)}
                      </td>
                      <td className="py-3 font-bold">
                        {item.score !== null ? (
                          <span className={(item.percentage ?? 0) >= 50 ? "text-emerald-600" : "text-amber-600"}>
                            {item.score}/{item.total_marks}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            item.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {item.status === "completed" ? "✓ " : ""}
                          {item.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              art={<EmptyExams />}
              title="No history yet — your victories will appear here"
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
