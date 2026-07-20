"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  FileText,
  Users,
  AlertTriangle,
  Clock,
  BarChart3,
  Eye,
  Send,
  Search,
  X,
  Loader2,
  CheckCircle,
  ClipboardList,
  LogOut,
  Activity,
  BookOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

function CourseCreateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", code: "", description: "", department: "", credits: "" });
  const mutation = useMutation({
    mutationFn: (data: any) => api.post("/api/v1/courses", data),
    onSuccess: () => {
      toast.success("Course created successfully");
      queryClient.invalidateQueries({ queryKey: ["teacher-courses"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Failed to create course"),
  });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.code) { toast.error("Name and code are required"); return; }
    mutation.mutate({ ...form, credits: form.credits ? parseInt(form.credits) : undefined });
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

function EnrollModal({
  examId,
  onClose,
}: {
  examId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: students, isLoading } = useQuery({
    queryKey: ["teacher-students", searchQuery],
    queryFn: () =>
      api.get(`/api/v1/teachers/students?q=${encodeURIComponent(searchQuery)}`),
    enabled: searchQuery.length >= 2,
  });

  const enrollMutation = useMutation({
    mutationFn: (studentId: string) =>
      api.post(`/api/v1/exams/${examId}/enroll`, { student_id: studentId }),
    onSuccess: () => {
      toast.success("Student enrolled");
      queryClient.invalidateQueries({ queryKey: ["teacher-exams"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to enroll student");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Enroll Students</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students by name or email..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
              autoFocus
            />
          </div>

          <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
            {searchQuery.length < 2 ? (
              <p className="text-gray-400 text-sm text-center py-8">
                Type at least 2 characters to search
              </p>
            ) : isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : students?.length > 0 ? (
              students.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{s.full_name}</p>
                    <p className="text-xs text-gray-500">{s.email}</p>
                  </div>
                  <button
                    onClick={() => enrollMutation.mutate(s.id)}
                    disabled={enrollMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {enrollMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3 w-3" />
                    )}
                    Enroll
                  </button>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm text-center py-8">
                No students found
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SubmissionsModal({
  examId,
  examTitle,
  onClose,
}: {
  examId: string;
  examTitle: string;
  onClose: () => void;
}) {
  const { data: submissions, isLoading } = useQuery({
    queryKey: ["exam-submissions", examId],
    queryFn: () => api.get(`/api/v1/teachers/exams/${examId}/submissions`),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 overflow-hidden max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div>
            <h3 className="font-semibold">Submissions</h3>
            <p className="text-sm text-gray-500">{examTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : submissions?.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-gray-600">Student</th>
                  <th className="pb-3 font-medium text-gray-600">Email</th>
                  <th className="pb-3 font-medium text-gray-600">Status</th>
                  <th className="pb-3 font-medium text-gray-600">Score</th>
                  <th className="pb-3 font-medium text-gray-600">Risk</th>
                  <th className="pb-3 font-medium text-gray-600">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s: any) => (
                  <tr key={s.enrollment_id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 font-medium">{s.student_name}</td>
                    <td className="py-3 text-gray-600">{s.student_email}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {s.score !== null ? (
                        <span className="font-medium">
                          {s.score}/{s.total_marks}
                          <span className="text-gray-500 ml-1">
                            ({s.percentage}%)
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {s.risk_level ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.risk_level === "critical" || s.risk_level === "high"
                              ? "bg-red-100 text-red-700"
                              : s.risk_level === "medium"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                          }`}
                        >
                          {s.risk_level}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-600 text-xs">
                      {s.submitted_at ? formatDate(s.submitted_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12">
              <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No submissions yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Enrolled students will appear here once they submit the exam
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function TeacherDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [enrollExamId, setEnrollExamId] = useState<string | null>(null);
  const [submissionsExam, setSubmissionsExam] = useState<{ id: string; title: string } | null>(null);
  const [showCourseCreate, setShowCourseCreate] = useState(false);
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
      if (!["teacher", "admin", "super_admin", "exam_controller"].includes(role)) {
        router.replace("/student/dashboard");
        return;
      }
    } catch {
      router.replace("/login");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  const { data: exams, isLoading, isError } = useQuery({
    queryKey: ["teacher-exams"],
    queryFn: () => api.get("/api/v1/teachers/exams"),
    enabled: authChecked,
    retry: 2,
  });

  const { data: courses } = useQuery({
    queryKey: ["teacher-courses"],
    queryFn: () => api.get("/api/v1/courses"),
    enabled: authChecked,
  });

  const { data: suspiciousStudents } = useQuery({
    queryKey: ["teacher-suspicious"],
    queryFn: () => api.get("/api/v1/teachers/suspicious"),
    enabled: authChecked,
    refetchInterval: 10000,
    retry: 2,
  });

  const publishMutation = useMutation({
    mutationFn: (examId: string) =>
      api.post(`/api/v1/exams/${examId}/publish`),
    onSuccess: () => {
      toast.success("Exam published successfully");
      queryClient.invalidateQueries({ queryKey: ["teacher-exams"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to publish exam");
    },
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
      {showCourseCreate && <CourseCreateModal onClose={() => setShowCourseCreate(false)} />}
      {enrollExamId && (
        <EnrollModal examId={enrollExamId} onClose={() => setEnrollExamId(null)} />
      )}
      {submissionsExam && (
        <SubmissionsModal
          examId={submissionsExam.id}
          examTitle={submissionsExam.title}
          onClose={() => setSubmissionsExam(null)}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Teacher Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            Manage exams and monitor student activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCourseCreate(true)}
            className="flex items-center gap-2 px-4 py-2 border border-primary text-primary rounded-lg font-medium hover:bg-primary/5"
          >
            <BookOpen className="h-4 w-4" />
            Create Course
          </button>
          <button
            onClick={() => router.push("/teacher/create-exam")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Create Exam
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Active Exams",
            value:
              exams?.filter((e: any) => e.status === "active")?.length || 0,
            icon: Clock,
            color: "text-green-600 bg-green-50",
          },
          {
            label: "Total Students",
            value:
              exams?.reduce(
                (acc: number, e: any) => acc + (e.student_count || 0),
                0
              ) || 0,
            icon: Users,
            color: "text-blue-600 bg-blue-50",
          },
          {
            label: "Suspicious Flags",
            value: suspiciousStudents?.length || 0,
            icon: AlertTriangle,
            color: "text-red-600 bg-red-50",
          },
          {
            label: "Pending Review",
            value:
              suspiciousStudents?.filter((s: any) => !s.reviewed)?.length || 0,
            icon: Eye,
            color: "text-orange-600 bg-orange-50",
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

      {/* My Courses */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">My Courses</h2>
          <span className="text-xs text-gray-500">{courses?.courses?.length || 0} courses</span>
        </div>
        {courses?.courses?.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses.courses.map((c: any) => (
              <div key={c.id} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <BookOpen className="h-5 w-5 text-primary mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.code}{c.department ? ` · ${c.department}` : ""}</p>
                    {c.description && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{c.description}</p>}
                    {c.credits && <p className="text-xs text-gray-400 mt-1">{c.credits} credits</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No courses yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Create a course to start organizing your exams
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Exams */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">My Exams</h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-gray-600">Failed to load exams</p>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["teacher-exams"] })}
                className="mt-2 text-primary text-sm hover:underline"
              >
                Try again
              </button>
            </div>
          ) : exams?.length > 0 ? (
            <div className="space-y-3">
              {exams.slice(0, 5).map((exam: any) => (
                <div
                  key={exam.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-sm">{exam.title}</p>
                        <p className="text-xs text-gray-500">
                          {exam.status} | {exam.duration_minutes} min |{" "}
                          {exam.student_count || 0} students
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        exam.status === "active"
                          ? "bg-green-100 text-green-700"
                          : exam.status === "draft"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {exam.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                    {exam.status === "draft" && (
                      <button
                        onClick={() => publishMutation.mutate(exam.id)}
                        disabled={publishMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {publishMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        Publish
                      </button>
                    )}
                    {exam.status === "active" && (
                      <button
                        onClick={() => setEnrollExamId(exam.id)}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary/90"
                      >
                        <Users className="h-3 w-3" />
                        Enroll
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setSubmissionsExam({ id: exam.id, title: exam.title })
                      }
                      className="flex items-center gap-1 px-3 py-1 text-xs border rounded-lg hover:bg-gray-100"
                    >
                      <ClipboardList className="h-3 w-3" />
                      Submissions
                    </button>
                    {exam.status === "active" && (
                      <button
                        onClick={() => router.push(`/teacher/live/${exam.id}`)}
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        <Activity className="h-3 w-3" />
                        Live
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No exams created yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Click "Create Exam" to get started
              </p>
            </div>
          )}
          {exams?.length > 5 && (
            <button className="w-full text-primary text-sm font-medium mt-4 hover:underline">
              View All Exams
            </button>
          )}
        </div>

        {/* Suspicious Students */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Suspicious Students</h2>
          {suspiciousStudents?.length > 0 ? (
            <div className="space-y-3">
              {suspiciousStudents.slice(0, 5).map((student: any) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium text-red-800">
                      {student.student_name || "Unknown Student"}
                    </p>
                    <p className="text-xs text-red-600">
                      Risk Score: {student.risk_score} | Exam:{" "}
                      {student.exam_title}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 text-xs bg-white border border-red-300 rounded-lg text-red-700 hover:bg-red-50">
                      Review
                    </button>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        student.risk_level === "critical"
                          ? "bg-red-200 text-red-800"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {student.risk_level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BarChart3 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No suspicious activity detected</p>
              <p className="text-xs text-gray-400 mt-1">
                All students are behaving within normal parameters
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
