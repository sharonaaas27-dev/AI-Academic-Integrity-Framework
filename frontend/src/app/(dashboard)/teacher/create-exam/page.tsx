"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Save, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useForm } from "react-hook-form";

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

export default function CreateExamPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<QuestionForm[]>([]);

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
      toast.success("Exam created successfully!");
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

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={() => router.push("/teacher/dashboard")}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Create New Exam</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Title *</label>
              <input
                {...register("title", { required: true })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="e.g. Midterm Examination"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                {...register("description")}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                placeholder="Optional exam description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
              <select
                {...register("course_id", { required: true })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="">Select a course</option>
                {courses?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes) *</label>
              <input
                type="number"
                {...register("duration_minutes", { required: true, min: 1 })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                {...register("difficulty_level")}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passing Marks</label>
              <input
                type="number"
                {...register("passing_marks")}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("require_fullscreen")} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700">Require fullscreen mode</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("allow_navigation")} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700">Allow question navigation</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" {...register("shuffle_questions")} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700">Shuffle questions</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
            <textarea
              {...register("instructions")}
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              placeholder="Instructions for students..."
            />
          </div>
        </div>

        {/* Questions */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Questions</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          </div>

          {questions.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              No questions added yet. Click "Add Question" to start.
            </p>
          )}

          <div className="space-y-6">
            {questions.map((q, qi) => (
              <div key={qi} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Question {qi + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeQuestion(qi)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <input
                      value={q.text}
                      onChange={(e) => updateQuestion(qi, "text", e.target.value)}
                      placeholder="Question text"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={q.question_type}
                      onChange={(e) => updateQuestion(qi, "question_type", e.target.value)}
                      className="px-3 py-2 border rounded-lg text-sm"
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
                      className="px-3 py-2 border rounded-lg text-sm"
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
                      className="px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>

                {["multiple_choice", "single_choice"].includes(q.question_type) && (
                  <div className="space-y-2 pl-4 border-l-2 border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">Options</span>
                      <button
                        type="button"
                        onClick={() => addOption(qi)}
                        className="text-xs text-primary hover:underline"
                      >
                        + Add option
                      </button>
                    </div>
                    {Object.entries(q.options).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-xs font-mono w-6 text-gray-500">{key}.</span>
                        <input
                          value={val as string}
                          onChange={(e) => updateOption(qi, key, e.target.value)}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                        />
                        <input
                          type="radio"
                          name={`correct-${qi}`}
                          checked={q.correct_answer === key}
                          onChange={() => updateQuestion(qi, "correct_answer", key)}
                          title="Mark as correct"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(qi, key)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {q.question_type === "short_answer" || q.question_type === "essay" ? (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Correct Answer</label>
                    <input
                      value={q.correct_answer}
                      onChange={(e) => updateQuestion(qi, "correct_answer", e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
                      placeholder="Expected answer (optional for essays)"
                    />
                  </div>
                ) : null}

                <div>
                  <input
                    value={q.explanation}
                    onChange={(e) => updateQuestion(qi, "explanation", e.target.value)}
                    placeholder="Explanation (shown after answering)"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/teacher/dashboard")}
            className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Create Exam
          </button>
        </div>
      </form>
    </div>
  );
}
