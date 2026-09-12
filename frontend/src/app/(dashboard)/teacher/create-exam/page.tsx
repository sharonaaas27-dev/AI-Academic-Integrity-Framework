"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ArrowLeft, Save, Loader2, Info, ListChecks, Rocket, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyQuestions } from "@/components/illustrations/scenes";

type QuestionForm = {
  question_type: string;
  text: string;
  marks: number;
  difficulty: string;
  options: Record<string, string>;
  correct_answer: string;
  correct_answers: string[];
  explanation: string;
};

const inputCls =
  "w-full px-4 py-2.5 border-2 border-amber-100 rounded-xl outline-none bg-amber-50/40 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100 transition-all placeholder:text-gray-400";
const miniCls =
  "px-3 py-2 border-2 border-amber-100 rounded-xl text-sm outline-none bg-white focus:border-orange-400 transition-all";

const STEPS = [
  { n: 1, label: "Basics", icon: Info },
  { n: 2, label: "Questions", icon: ListChecks },
  { n: 3, label: "Launch", icon: Rocket },
];

export default function CreateExamPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [step, setStep] = useState(1);

  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<any[]>("/api/v1/teachers/courses"),
  });

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      title: "",
      description: "",
      course_id: "",
      duration_minutes: 60,
      difficulty_level: "medium",
      instructions: "",
      require_fullscreen: true,
      allow_navigation: true,
      shuffle_questions: false,
      max_attempts: 1,
      passing_marks: 0,
    },
  });
  const title = watch("title");

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
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/v1/exams", data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["teacher-exams"] });
      toast.success("Exam created — ready to publish!");
      router.push("/teacher/dashboard");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create exam");
    },
  });

  const addQuestion = () => {
    setQuestions([...questions, {
      question_type: "multiple_choice",
      text: "",
      marks: 1,
      difficulty: "medium",
      options: {},
      correct_answer: "",
      correct_answers: [],
      explanation: "",
    }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions];
    (updated[index] as any)[field] = value;
    setQuestions(updated);
  };

  const addOption = (qIndex: number) => {
    const q = questions[qIndex];
    const key = String.fromCharCode(65 + Object.keys(q.options).length);
    updateQuestion(qIndex, "options", { ...q.options, [key]: "" });
  };

  const updateOption = (qIndex: number, key: string, value: string) => {
    const q = questions[qIndex];
    updateQuestion(qIndex, "options", { ...q.options, [key]: value });
  };

  const removeOption = (qIndex: number, key: string) => {
    const q = questions[qIndex];
    const { [key]: _, ...rest } = q.options;
    updateQuestion(qIndex, "options", rest);
  };

  const onSubmit = (formData: any) => {
    if (questions.length === 0) {
      toast.error("Add at least one question");
      setStep(2);
      return;
    }

    const payload = {
      ...formData,
      course_id: formData.course_id,
      questions: questions.map((q, i) => ({
        question_type: q.question_type,
        text: q.text,
        marks: Number(q.marks),
        difficulty: q.difficulty,
        order_index: i,
        options: Object.keys(q.options).length > 0 ? q.options : null,
        correct_answer: q.correct_answer || null,
        correct_answers: q.correct_answers.length > 0 ? q.correct_answers : null,
        explanation: q.explanation || null,
      })),
    };

    createMutation.mutate(payload);
  };

  const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  return (
    <div className="bg-campus min-h-screen">
      <div className="mx-auto max-w-5xl p-6">
        <button
          onClick={() => router.push("/teacher/dashboard")}
          className="mb-6 flex items-center gap-2 rounded-full border-2 border-amber-200 bg-white px-4 py-1.5 text-sm font-bold text-gray-600 transition-all hover:border-orange-300 hover:text-orange-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-extrabold text-gray-900">
            {title || "Create New Exam"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Build it in three happy steps</p>
        </motion.div>

        {/* Stepper */}
        <div className="mt-6 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(s.n)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-sm font-bold transition-all ${
                  step === s.n
                    ? "border-orange-400 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-orange-200"
                    : step > s.n
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-amber-100 bg-white text-gray-400"
                }`}
              >
                {step > s.n ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                <span className="hidden sm:inline">{s.n}. {s.label}</span>
                <span className="sm:hidden">{s.n}</span>
              </button>
              {i < STEPS.length - 1 && <div className={`h-1 w-4 flex-shrink-0 rounded-full md:w-8 ${step > s.n ? "bg-emerald-300" : "bg-amber-100"}`} />}
            </div>
          ))}
        </div>

        {/* live progress */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-amber-100 bg-white px-4 py-2.5 text-sm font-medium text-gray-500">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-amber-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400"
              animate={{ width: `${Math.min(100, (questions.length / 5) * 100 + (title ? 20 : 0))}%` }}
            />
          </div>
          <span className="font-bold text-gray-700">{questions.length} questions</span>
          <span className="font-bold text-orange-600">{totalMarks} marks</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-8">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="basics"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-4 rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm"
              >
                <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900">
                  <Info className="h-5 w-5 text-teal-600" />
                  Basic Information
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-bold text-gray-700">Exam Title *</label>
                    <input
                      {...register("title", { required: true })}
                      className={inputCls}
                      placeholder="e.g. Midterm Examination"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-bold text-gray-700">Description</label>
                    <textarea
                      {...register("description")}
                      rows={3}
                      className={inputCls}
                      placeholder="Optional exam description"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-bold text-gray-700">Course *</label>
                    <select {...register("course_id", { required: true })} className={inputCls}>
                      <option value="">Select a course</option>
                      {courses?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-bold text-gray-700">Duration (minutes) *</label>
                    <input
                      type="number"
                      {...register("duration_minutes", { required: true, min: 1 })}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-bold text-gray-700">Difficulty</label>
                    <select {...register("difficulty_level")} className={inputCls}>
                      <option value="easy">Easy — gentle warm-up</option>
                      <option value="medium">Medium — just right</option>
                      <option value="hard">Hard — spicy challenge</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-bold text-gray-700">Passing Marks</label>
                    <input type="number" {...register("passing_marks")} className={inputCls} />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { key: "require_fullscreen", label: "Require fullscreen" },
                    { key: "allow_navigation", label: "Allow navigation" },
                    { key: "shuffle_questions", label: "Shuffle questions" },
                  ].map((c) => (
                    <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-2xl border-2 border-amber-100 bg-amber-50/50 px-3 py-2.5 transition-all hover:border-orange-300">
                      <input type="checkbox" {...register(c.key as any)} className="h-4 w-4 rounded accent-orange-500" />
                      <span className="text-sm font-semibold text-gray-700">{c.label}</span>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-700">Instructions</label>
                  <textarea
                    {...register("instructions")}
                    rows={4}
                    className={inputCls}
                    placeholder="Instructions for students..."
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-full bg-gray-900 px-6 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
                  >
                    Next: Questions →
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="questions"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-lg font-extrabold text-gray-900">
                    <ListChecks className="h-5 w-5 text-orange-500" />
                    Questions
                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700">{questions.length}</span>
                  </h2>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-orange-200 transition-transform hover:scale-105"
                  >
                    <Plus className="h-4 w-4" />
                    Add Question
                  </button>
                </div>

                {questions.length === 0 && (
                  <EmptyState
                    art={<EmptyQuestions />}
                    title="A blank page full of possibility!"
                    hint='Click "Add Question" to write your first one'
                    action={
                      <button type="button" onClick={addQuestion} className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-sm font-bold text-white">
                        + Add your first question
                      </button>
                    }
                  />
                )}

                <div className="space-y-5">
                  <AnimatePresence initial={false}>
                    {questions.map((q, qi) => (
                      <motion.div
                        key={qi}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0, overflow: "hidden" }}
                        className="space-y-3 rounded-2xl border-2 border-amber-100 bg-gradient-to-b from-white to-amber-50/50 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-extrabold text-white">Question {qi + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeQuestion(qi)}
                            className="rounded-full p-1.5 text-rose-400 transition-all hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Delete question ${qi + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div className="md:col-span-2">
                            <input
                              value={q.text}
                              onChange={(e) => updateQuestion(qi, "text", e.target.value)}
                              placeholder="Question text"
                              className={miniCls + " w-full font-medium"}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <select
                              value={q.question_type}
                              onChange={(e) => updateQuestion(qi, "question_type", e.target.value)}
                              className={miniCls}
                            >
                              <option value="multiple_choice">MCQ</option>
                              <option value="single_choice">Single</option>
                              <option value="true_false">True/False</option>
                              <option value="short_answer">Short Answer</option>
                              <option value="essay">Essay</option>
                            </select>
                            <select
                              value={q.difficulty}
                              onChange={(e) => updateQuestion(qi, "difficulty", e.target.value)}
                              className={miniCls}
                            >
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                            <input
                              type="number"
                              value={q.marks}
                              onChange={(e) => updateQuestion(qi, "marks", e.target.value)}
                              placeholder="Marks"
                              className={miniCls}
                            />
                          </div>
                        </div>

                        {["multiple_choice", "single_choice"].includes(q.question_type) && (
                          <div className="space-y-2 rounded-2xl border-l-4 border-orange-300 bg-white p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Options</span>
                              <button
                                type="button"
                                onClick={() => addOption(qi)}
                                className="text-xs font-bold text-orange-600 hover:underline"
                              >
                                + Add option
                              </button>
                            </div>
                            {Object.entries(q.options).map(([key, val]) => (
                              <motion.div key={key} layout className="flex items-center gap-2">
                                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-extrabold text-gray-600">{key}</span>
                                <input
                                  value={val as string}
                                  onChange={(e) => updateOption(qi, key, e.target.value)}
                                  className={miniCls + " flex-1"}
                                  placeholder={`Option ${key}`}
                                />
                                <input
                                  type="radio"
                                  name={`correct-${qi}`}
                                  checked={q.correct_answer === key}
                                  onChange={() => updateQuestion(qi, "correct_answer", key)}
                                  title="Mark as correct"
                                  className="h-4 w-4 accent-emerald-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeOption(qi, key)}
                                  className="text-rose-300 transition-colors hover:text-rose-600"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {q.question_type === "short_answer" || q.question_type === "essay" ? (
                          <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Correct Answer</label>
                            <input
                              value={q.correct_answer}
                              onChange={(e) => updateQuestion(qi, "correct_answer", e.target.value)}
                              className={miniCls + " mt-1 w-full"}
                              placeholder="Expected answer (optional for essays)"
                            />
                          </div>
                        ) : null}

                        <div>
                          <input
                            value={q.explanation}
                            onChange={(e) => updateQuestion(qi, "explanation", e.target.value)}
                            placeholder="Explanation (shown after answering)"
                            className={miniCls + " w-full"}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="mt-6 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-full border-2 border-amber-200 px-6 py-2.5 text-sm font-bold text-gray-600 transition-all hover:border-orange-300"
                  >
                    ← Basics
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-full bg-gray-900 px-6 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
                  >
                    Next: Launch →
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="launch"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-4 rounded-3xl border-2 border-emerald-200 bg-white p-6 text-center shadow-sm"
              >
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500">
                  <Rocket className="h-8 w-8 text-white" />
                </span>
                <h2 className="text-2xl font-extrabold text-gray-900">Ready for liftoff?</h2>
                <p className="mx-auto max-w-md text-sm text-gray-500">
                  <span className="font-bold text-gray-800">{title || "Your exam"}</span> with{" "}
                  <span className="font-bold text-orange-600">{questions.length} questions</span> worth{" "}
                  <span className="font-bold text-orange-600">{totalMarks} marks</span>.
                  Publish it from the dashboard when students should see it.
                </p>
                <div className="mx-auto grid max-w-md grid-cols-3 gap-2 text-center">
                  {[
                    { v: `${questions.length}`, l: "Questions" },
                    { v: `${totalMarks}`, l: "Marks" },
                    { v: watch("duration_minutes") + "m", l: "Duration" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-2xl border-2 border-amber-100 bg-amber-50/60 p-3">
                      <p className="text-xl font-extrabold text-gray-900">{s.v}</p>
                      <p className="text-xs font-medium text-gray-500">{s.l}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => router.push("/teacher/dashboard")}
                    className="rounded-full border-2 border-amber-200 px-6 py-2.5 font-bold text-gray-600 transition-all hover:border-orange-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-2.5 font-bold text-white shadow-lg shadow-emerald-200 transition-transform hover:scale-105 disabled:opacity-50"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Create Exam
                  </button>
                </div>
                <button type="button" onClick={() => setStep(2)} className="text-sm font-bold text-orange-600 hover:underline">
                  ← Back to questions
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </div>
  );
}
