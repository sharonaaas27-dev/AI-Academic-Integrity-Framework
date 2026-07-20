"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  FileText,
  Loader2,
  ArrowLeft,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function AdminExamsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

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
    queryKey: ["admin-exams", page, statusFilter],
    queryFn: () =>
      api.get(
        `/api/v1/admin/exams?page=${page}&per_page=20${statusFilter ? `&status=${statusFilter}` : ""}`
      ),
    enabled: authChecked,
  });

  const filtered = data?.exams?.filter((e: any) =>
    !search || e.title.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil((data?.total || 0) / 20);

  if (!authChecked) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            <h1 className="text-xl font-bold">All Exams</h1>
            <p className="text-sm text-gray-500">{data?.total || 0} total exams</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered?.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3 font-medium text-gray-600">Title</th>
                <th className="text-left p-3 font-medium text-gray-600">Course</th>
                <th className="text-left p-3 font-medium text-gray-600">Teacher</th>
                <th className="text-left p-3 font-medium text-gray-600">Status</th>
                <th className="text-center p-3 font-medium text-gray-600">Duration</th>
                <th className="text-center p-3 font-medium text-gray-600">Students</th>
                <th className="text-right p-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exam: any) => (
                <tr key={exam.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-medium">{exam.title}</td>
                  <td className="p-3 text-gray-600">{exam.course_name || "—"}</td>
                  <td className="p-3 text-gray-600">{exam.teacher_name || "—"}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        exam.status === "active"
                          ? "bg-green-100 text-green-700"
                          : exam.status === "draft"
                            ? "bg-gray-100 text-gray-600"
                            : exam.status === "completed"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                      }`}
                    >
                      {exam.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3 text-gray-400" />
                      {exam.duration_minutes}m
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="flex items-center justify-center gap-1">
                      <Users className="h-3 w-3 text-gray-400" />
                      {exam.total_students}
                    </span>
                  </td>
                  <td className="p-3 text-right text-gray-600 text-xs">
                    {exam.created_at ? formatDate(exam.created_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No exams found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
            .map((p, idx, arr) => (
              <span key={p} className="flex items-center gap-1">
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-gray-400">...</span>}
                <button
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    p === page
                      ? "bg-primary text-white"
                      : "border hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              </span>
            ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
