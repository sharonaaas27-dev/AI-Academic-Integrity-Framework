"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Clock,
  FileText,
  CheckCircle,
  AlertTriangle,
  GraduationCap,
  ArrowRight,
  LogOut,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function StudentDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
      if (!["student"].includes(role)) {
        router.replace("/teacher/dashboard");
        return;
      }
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Student Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            View your upcoming exams and history
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Upcoming Exams",
            value: exams?.length || 0,
            icon: Clock,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Completed",
            value: history?.length || 0,
            icon: CheckCircle,
            color: "text-green-600 bg-green-50",
          },
          {
            label: "Pending Review",
            value: 0,
            icon: AlertTriangle,
            color: "text-yellow-600 bg-yellow-50",
          },
          {
            label: "Average Score",
            value: "—",
            icon: GraduationCap,
            color: "text-purple-600 bg-purple-50",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-5 rounded-xl shadow-sm border"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Upcoming Exams */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Upcoming Exams</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-20 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-gray-600">Failed to load exams</p>
            <button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["student-exams"] })
              }
              className="mt-2 text-primary text-sm hover:underline"
            >
              Try again
            </button>
          </div>
        ) : exams?.length > 0 ? (
          <div className="space-y-3">
            {exams.map((exam: any) => (
              <div
                key={exam.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <FileText className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">{exam.title}</p>
                    <p className="text-sm text-gray-600">
                      {exam.course_name} | {exam.duration_minutes} min
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(exam.start_time)}
                    </p>
                  </div>
                </div>
                <Link
                  href={"/student/exam/" + exam.id}
                  className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
                >
                  Join Exam
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No upcoming exams</p>
            <p className="text-xs text-gray-400 mt-1">
              Ask your teacher to enroll you in an exam
            </p>
          </div>
        )}
      </div>

      {/* Recent History */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Exam History</h2>
        {history?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-gray-600">Exam</th>
                  <th className="pb-3 font-medium text-gray-600">Date</th>
                  <th className="pb-3 font-medium text-gray-600">Score</th>
                  <th className="pb-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item: any) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3">{item.exam_title}</td>
                    <td className="py-3 text-gray-600">
                      {formatDate(item.submitted_at)}
                    </td>
                    <td className="py-3 font-medium">
                      {item.score !== null
                        ? `${item.score}/${item.total_marks}`
                        : "—"}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No exam history yet
          </p>
        )}
      </div>
    </div>
  );
}
