"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  Loader2,
  ArrowLeft,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function AdminCoursesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [authChecked, setAuthChecked] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

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
    queryKey: ["admin-courses", page, institutionFilter],
    queryFn: () =>
      api.get(
        `/api/v1/courses?page=${page}&per_page=20${institutionFilter ? `&institution_id=${institutionFilter}` : ""}`
      ),
    enabled: authChecked,
  });

  const { data: institutions } = useQuery({
    queryKey: ["admin-institutions"],
    queryFn: () => api.get("/api/v1/admin/institutions"),
    enabled: authChecked,
  });

  const filtered = (data?.courses ?? []).filter((c: any) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
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
      {showCreate && (
        <CreateCourseModal
          institutions={institutions || []}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-courses"] });
            setShowCreate(false);
          }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/admin/dashboard")}
            className="p-2 border rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Courses</h1>
            <p className="text-sm text-gray-500">{data?.total || 0} total courses</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Course
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>
        <select
          value={institutionFilter}
          onChange={(e) => { setInstitutionFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Institutions</option>
          {(institutions || []).map((inst: any) => (
            <option key={inst.id} value={inst.id}>{inst.name}</option>
          ))}
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
                <th className="text-left p-3 font-medium text-gray-600">Name</th>
                <th className="text-left p-3 font-medium text-gray-600">Code</th>
                <th className="text-left p-3 font-medium text-gray-600">Department</th>
                <th className="text-center p-3 font-medium text-gray-600">Credits</th>
                <th className="text-right p-3 font-medium text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((course: any) => (
                <tr key={course.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="p-3 font-medium">{course.name}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">{course.code}</span>
                  </td>
                  <td className="p-3 text-gray-600">{course.department || "—"}</td>
                  <td className="p-3 text-center">{course.credits || "—"}</td>
                  <td className="p-3 text-right text-gray-600 text-xs">
                    {course.created_at ? formatDate(course.created_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No courses found</p>
          </div>
        )}
      </div>

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
                    p === page ? "bg-primary text-white" : "border hover:bg-gray-50"
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

function CreateCourseModal({
  institutions,
  onClose,
  onSuccess,
}: {
  institutions: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    name: "", code: "", description: "", department: "", credits: "", institution_id: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/api/v1/courses", data),
    onSuccess: () => {
      toast.success("Course created successfully");
      onSuccess();
    },
    onError: (err: any) => toast.error(err.message || "Failed to create course"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) { toast.error("Name and code are required"); return; }
    mutation.mutate({
      name: form.name,
      code: form.code,
      description: form.description || undefined,
      department: form.department || undefined,
      credits: form.credits ? parseInt(form.credits) : undefined,
      institution_id: form.institution_id || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Create Course</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Institution</label>
            <select
              value={form.institution_id}
              onChange={(e) => setForm({ ...form, institution_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              <option value="">Select institution... (required)</option>
              {institutions.map((inst: any) => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Code *</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="e.g. CS101"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Department</label>
              <input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Credits</label>
              <input
                type="number"
                value={form.credits}
                onChange={(e) => setForm({ ...form, credits: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                min={0}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create Course
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
