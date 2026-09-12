"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  Radio,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyExams, EmptyAlerts, EmptyStudents } from "@/components/illustrations/scenes";

const inputCls =
  "w-full px-3 py-2 border-2 border-amber-100 rounded-xl text-sm outline-none bg-amber-50/40 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100 transition-all";

function ModalShell({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className={`w-full overflow-hidden rounded-3xl border-2 border-amber-100 bg-white shadow-2xl ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex items-center justify-between border-b-2 border-amber-100 bg-gradient-to-r from-amber-50 to-white p-4">
          <div>
            <h3 className="font-extrabold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-amber-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

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
    <ModalShell title="Create Course" subtitle="Organize exams into a course" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Code *</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              className={inputCls}
              placeholder="e.g. CS101"
              required
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputCls}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Department</label>
            <input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Credits</label>
            <input
              type="number"
              value={form.credits}
              onChange={(e) => setForm({ ...form, credits: e.target.value })}
              className={inputCls}
              min={0}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-amber-200 px-4 py-2 text-sm font-bold text-gray-600 transition-all hover:border-orange-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-orange-200 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Course
          </button>
        </div>
      </form>
    </ModalShell>
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
    <ModalShell title="Enroll Students" subtitle="Search and add students to this exam" onClose={onClose}>
      <div className="p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students by name or email..."
            className={`${inputCls} pl-10`}
            autoFocus
          />
        </div>

        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {searchQuery.length < 2 ? (
            <EmptyState art={<EmptyStudents />} title="Find your students" hint="Type at least 2 characters to search" />
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
          ) : students?.length > 0 ? (
            students.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-2xl border-2 border-amber-100 p-3 transition-colors hover:bg-amber-50/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 text-sm font-extrabold text-white">
                    {(s.full_name || s.email || "?")[0].toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{s.full_name}</p>
                    <p className="text-xs text-gray-500">{s.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => enrollMutation.mutate(s.id)}
                  disabled={enrollMutation.isPending}
                  className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
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
            <EmptyState art={<EmptyStudents />} title="No students found" hint="Try a different name or email" />
          )}
        </div>
      </div>
    </ModalShell>
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
    <ModalShell title="Submissions" subtitle={examTitle} onClose={onClose} wide>
      <div className="max-h-[60vh] flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : submissions?.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-amber-100 text-left">
                <th className="pb-3 font-bold text-gray-500">Student</th>
                <th className="pb-3 font-bold text-gray-500">Email</th>
                <th className="pb-3 font-bold text-gray-500">Status</th>
                <th className="pb-3 font-bold text-gray-500">Score</th>
                <th className="pb-3 font-bold text-gray-500">Risk</th>
                <th className="pb-3 font-bold text-gray-500">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s: any) => (
                <tr key={s.enrollment_id} className="border-b border-amber-50 transition-colors last:border-0 hover:bg-amber-50/50">
                  <td className="py-3 font-bold">{s.student_name}</td>
                  <td className="py-3 text-gray-600">{s.student_email}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        s.status === "completed"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3">
                    {s.score !== null ? (
                      <span className="font-bold">
                        {s.score}/{s.total_marks}
                        <span className="ml-1 text-gray-500">
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
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          s.risk_level === "critical" || s.risk_level === "high"
                            ? "bg-rose-100 text-rose-700"
                            : s.risk_level === "medium"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {s.risk_level}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 text-xs text-gray-600">
                    {s.submitted_at ? formatDate(s.submitted_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            art={<EmptyExams />}
            title="No submissions yet"
            hint="Enrolled students will appear here once they submit the exam"
          />
        )}
      </div>
    </ModalShell>
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
      <div className="bg-campus flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="bg-campus min-h-screen">
      <div className="mx-auto max-w-7xl p-6">
        <AnimatePresence>
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
        </AnimatePresence>

        <PageHeader
          title="Teacher Dashboard"
          subtitle="Manage exams and keep an eye on integrity"
          actions={
            <>
              <button
                onClick={() => setShowCourseCreate(true)}
                className="flex items-center gap-2 rounded-full border-2 border-orange-300 bg-white px-4 py-2 font-bold text-orange-600 transition-all hover:bg-orange-50"
              >
                <BookOpen className="h-4 w-4" />
                Create Course
              </button>
              <button
                onClick={() => router.push("/teacher/create-exam")}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 font-bold text-white shadow-md shadow-orange-200 transition-transform hover:scale-105"
              >
                <Plus className="h-4 w-4" />
                Create Exam
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-full border-2 border-amber-200 bg-white px-3 py-2 text-gray-600 transition-all hover:border-orange-300 hover:text-orange-600"
                aria-label="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          }
        />

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={Clock} label="Active Exams" value={exams?.filter((e: any) => e.status === "active")?.length || 0} color="green" index={0} />
          <StatCard icon={Users} label="Total Students" value={exams?.reduce((acc: number, e: any) => acc + (e.student_count || 0), 0) || 0} color="blue" index={1} />
          <StatCard icon={AlertTriangle} label="Suspicious Flags" value={suspiciousStudents?.length || 0} color="red" index={2} />
          <StatCard icon={Eye} label="Pending Review" value={suspiciousStudents?.filter((s: any) => !s.reviewed)?.length || 0} color="orange" index={3} />
        </div>

        {/* My Courses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900">
              <BookOpen className="h-5 w-5 text-teal-600" />
              My Courses
            </h2>
            <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-700">{courses?.courses?.length || 0} courses</span>
          </div>
          {courses?.courses?.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courses.courses.map((c: any, i: number) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -3 }}
                  className="rounded-2xl border-2 border-amber-100 bg-gradient-to-br from-white to-amber-50/60 p-3 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 p-2">
                      <BookOpen className="h-4 w-4 text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{c.name}</p>
                      <p className="text-xs font-semibold text-teal-700">{c.code}{c.department ? ` · ${c.department}` : ""}</p>
                      {c.description && <p className="mt-1 line-clamp-2 text-xs text-gray-400">{c.description}</p>}
                      {c.credits && <p className="mt-1 text-xs text-gray-400">{c.credits} credits</p>}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <EmptyState
              art={<EmptyExams />}
              title="No courses yet"
              hint="Create a course to start organizing your exams"
              action={
                <button onClick={() => setShowCourseCreate(true)} className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-bold text-white">
                  Create your first course
                </button>
              }
            />
          )}
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* My Exams */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-gray-900">
              <FileText className="h-5 w-5 text-orange-500" />
              My Exams
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : isError ? (
              <div className="py-8 text-center">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-rose-400" />
                <p className="font-medium text-gray-600">Failed to load exams</p>
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["teacher-exams"] })}
                  className="mt-2 text-sm font-bold text-orange-600 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : exams?.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {exams.slice(0, 5).map((exam: any, i: number) => (
                    <motion.div
                      key={exam.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="rounded-2xl border-2 border-amber-100 p-3 transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="rounded-xl bg-amber-100 p-2">
                            <FileText className="h-4 w-4 text-orange-600" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-900">{exam.title}</p>
                            <p className="text-xs text-gray-500">
                              {exam.duration_minutes} min |{" "}
                              {exam.student_count || 0} students
                            </p>
                          </div>
                        </div>
                        <span
                          className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                            exam.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : exam.status === "draft"
                                ? "bg-gray-100 text-gray-600"
                                : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {exam.status === "active" ? "● " : ""}{exam.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-amber-100 pt-2">
                        {exam.status === "draft" && (
                          <button
                            onClick={() => publishMutation.mutate(exam.id)}
                            disabled={publishMutation.isPending}
                            className="flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white transition-transform hover:scale-105 disabled:opacity-50"
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
                            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-xs font-bold text-white transition-transform hover:scale-105"
                          >
                            <Users className="h-3 w-3" />
                            Enroll
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setSubmissionsExam({ id: exam.id, title: exam.title })
                          }
                          className="flex items-center gap-1 rounded-full border-2 border-amber-200 px-3 py-1 text-xs font-bold text-gray-600 transition-all hover:border-orange-300"
                        >
                          <ClipboardList className="h-3 w-3" />
                          Submissions
                        </button>
                        {exam.status === "active" && (
                          <button
                            onClick={() => router.push(`/teacher/live/${exam.id}`)}
                            className="flex items-center gap-1 rounded-full bg-violet-500 px-3 py-1 text-xs font-bold text-white transition-transform hover:scale-105"
                          >
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                            </span>
                            <Activity className="h-3 w-3" />
                            Live
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <EmptyState
                art={<EmptyExams />}
                title="No exams yet — let's make one!"
                hint='Click "Create Exam" to get started'
              />
            )}
          </motion.div>

          {/* Suspicious Students */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-3xl border-2 border-rose-200 bg-gradient-to-b from-rose-50/60 to-white p-6 shadow-sm"
          >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-extrabold text-gray-900">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
              </span>
              Suspicious Students
              <Radio className="h-4 w-4 text-rose-400" />
            </h2>
            {suspiciousStudents?.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {suspiciousStudents.slice(0, 5).map((student: any) => (
                    <motion.div
                      key={student.id}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="flex items-center justify-between gap-2 rounded-2xl border-2 border-rose-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-orange-400 text-sm font-extrabold text-white">
                          {(student.student_name || "?")[0].toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-gray-900">
                            {student.student_name || "Unknown Student"}
                          </p>
                          <p className="text-xs text-gray-500">
                            Score <span className="font-bold text-rose-600">{student.risk_score}</span> | {student.exam_title}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            student.risk_level === "critical"
                              ? "animate-pulse bg-rose-500 text-white"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {student.risk_level}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <EmptyState
                art={<EmptyAlerts />}
                title="All clear! No funny business"
                hint="All students are behaving within normal parameters"
              />
            )}
          </motion.div>
        </div>

        {/* footer strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400"
        >
          <BarChart3 className="h-4 w-4" />
          Suspicious list refreshes every 10 seconds
        </motion.div>
      </div>
    </div>
  );
}
