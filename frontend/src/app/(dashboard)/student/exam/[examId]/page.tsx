"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  Shield,
  BookOpen,
  Award,
  Target,
  Send,
} from "lucide-react";
import { api } from "@/lib/api";
import { createBehaviorMonitor } from "@sdk/behavior-monitor";
import { generateSessionId } from "@/lib/utils";
import { toast } from "sonner";
import { OwlMascot } from "@/components/illustrations/OwlMascot";
import { ProgressRing } from "@/components/ui/ProgressRing";

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [examStarted, setExamStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const monitorRef = useRef<any>(null);
  const sessionId = useRef(generateSessionId());

  const { data: exam, isLoading } = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => api.get(`/api/v1/exams/${examId}`),
  });

  // Initialize behavior monitor
  useEffect(() => {
    if (!examStarted || !exam) return;

    let studentId = "unknown";
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (user.id) studentId = user.id;
    } catch {} // eslint-disable-line no-empty
    const monitor = createBehaviorMonitor({
      apiUrl:
        process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000"),
      examId,
      studentId,
      sessionId: sessionId.current,
      flushInterval: 5000,
      debug: process.env.NODE_ENV === "development",
    });

    monitor.init();
    monitor.trackExamStart();
    monitorRef.current = monitor;

    return () => {
      monitor.destroy();
    };
  }, [examStarted, examId, exam]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      if (monitorRef.current) {
        monitorRef.current.trackExamSubmit();
      }

      await api.post(`/api/v1/exams/${examId}/submit`, {
        answers,
        session_id: sessionId.current,
        time_taken: (exam?.duration_minutes * 60 || 0) - timeRemaining,
      });

      toast.success("Exam submitted — great work!");
      router.push("/student/dashboard");
    } catch (error) {
      toast.error("Failed to submit exam");
      setSubmitting(false);
    }
  };

  // Timer
  useEffect(() => {
    if (!timeRemaining || !examStarted) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, examStarted]);

  const startExam = async () => {
    try {
      await api.post(`/api/v1/exams/${examId}/start`);
    } catch {
      toast.error("Failed to start exam. Please try again.");
      return;
    }
    if (exam?.duration_minutes) {
      setTimeRemaining(exam.duration_minutes * 60);
    }
    setExamStarted(true);
  };

  const handleAnswerChange = useCallback(
    (questionId: string, answer: string) => {
      const prevAnswer = answers[questionId] || "";
      setAnswers((prev) => ({ ...prev, [questionId]: answer }));

      if (monitorRef.current) {
        monitorRef.current.trackAnswerEdit(questionId, prevAnswer, answer);
      }
    },
    [answers]
  );

  const handleQuestionChange = useCallback(
    (questionIndex: number) => {
      if (monitorRef.current && exam?.questions) {
        monitorRef.current.trackQuestionChange(
          exam.questions[currentQuestion]?.id,
          currentQuestion,
          "navigate"
        );
      }
      setCurrentQuestion(questionIndex);
    },
    [currentQuestion, exam]
  );

  const toggleFlag = () => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion)) next.delete(currentQuestion);
      else next.add(currentQuestion);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="bg-campus flex h-screen items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-8 w-8 text-orange-500" />
        </motion.div>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="bg-campus flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="w-full max-w-2xl space-y-6 rounded-3xl border-2 border-amber-100 bg-white p-8 shadow-2xl shadow-orange-100"
        >
          <div className="flex flex-col items-center text-center">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="rounded-full bg-gradient-to-br from-teal-100 to-amber-100 p-4"
            >
              <OwlMascot className="h-24 w-24" wave />
            </motion.div>
            <h1 className="mt-4 text-3xl font-extrabold text-gray-900">{exam?.title}</h1>
            <p className="mt-2 text-gray-600">{exam?.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { icon: Clock, label: "Duration", v: `${exam?.duration_minutes} min` },
              { icon: BookOpen, label: "Questions", v: `${exam?.questions?.length || 0}` },
              { icon: Award, label: "Total Marks", v: `${exam?.total_marks}` },
              { icon: Target, label: "To Pass", v: `${exam?.passing_marks}` },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="rounded-2xl border-2 border-amber-100 bg-amber-50/60 p-3 text-center"
              >
                <s.icon className="mx-auto h-5 w-5 text-orange-500" />
                <p className="mt-1 text-lg font-extrabold text-gray-900">{s.v}</p>
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="flex items-start gap-3 rounded-2xl border-2 border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
            <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600" />
            <p>
              Our friendly owl watches behavior (mouse, keys, focus) to keep
              things fair. No webcam, no personal data — just evidence for
              your teacher.
              {exam?.require_fullscreen && (
                <span className="mt-1 block font-bold text-amber-700">
                  Fullscreen mode is required throughout the exam.
                </span>
              )}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startExam}
            className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-lg font-extrabold text-white shadow-lg shadow-orange-200 transition-shadow hover:shadow-xl"
          >
            Start Exam — you&apos;ve got this!
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (!exam?.questions?.length) {
    return <div className="bg-campus flex h-screen items-center justify-center font-medium text-gray-500">No questions found</div>;
  }

  const question = exam.questions[currentQuestion];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = exam.questions.length;
  const totalDuration = (exam?.duration_minutes || 1) * 60;
  const hours = Math.floor(timeRemaining / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;
  const urgent = timeRemaining < 300;
  const progress = totalQuestions ? answeredCount / totalQuestions : 0;

  return (
    <div className="bg-campus flex h-screen flex-col">
      {/* Exam Header */}
      <header className="flex items-center justify-between border-b-2 border-amber-100 bg-white px-4 py-2.5 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-1.5">
            <Shield className="h-4 w-4 text-white" />
          </span>
          <span className="truncate font-bold text-gray-900">{exam?.title}</span>
        </div>
        <div className="flex items-center gap-3 md:gap-5">
          {/* progress bar */}
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-2.5 w-28 overflow-hidden rounded-full bg-amber-100">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500"
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className="text-xs font-bold text-gray-600">
              {answeredCount}/{totalQuestions}
            </span>
          </div>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-sm font-bold ${urgent ? "animate-pulse bg-rose-100 text-rose-600" : "bg-amber-100 text-gray-800"}`}>
            <ProgressRing progress={timeRemaining / totalDuration} size={30} stroke={4} urgent={urgent} />
            <Clock className="h-4 w-4" />
            {hours > 0 ? `${hours}:` : ""}
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-200 transition-transform hover:scale-105"
          >
            <Send className="h-3.5 w-3.5" />
            Submit
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Question Navigator */}
        <div className="w-20 overflow-y-auto border-r-2 border-amber-100 bg-white p-3 md:w-64 md:p-4">
          <h3 className="mb-3 hidden text-sm font-bold text-gray-500 md:block">
            Questions
          </h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {exam.questions.map((_: any, i: number) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleQuestionChange(i)}
                className={`relative h-9 rounded-xl text-sm font-bold transition-all ${
                  currentQuestion === i
                    ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-orange-200"
                    : answers[exam.questions[i].id]
                      ? "border-2 border-emerald-300 bg-emerald-100 text-emerald-700"
                      : "border-2 border-amber-100 bg-amber-50/50 text-gray-500 hover:border-orange-300"
                }`}
              >
                {i + 1}
                {flagged.has(i) && (
                  <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-amber-400 text-amber-600" />
                )}
              </motion.button>
            ))}
          </div>
          <div className="mt-4 hidden space-y-2 text-xs font-medium text-gray-500 md:block">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded border-2 border-emerald-300 bg-emerald-100" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-gradient-to-br from-amber-500 to-orange-500" />
              <span>Current</span>
            </div>
            <div className="flex items-center gap-2">
              <Flag className="h-3 w-3 text-amber-500" />
              <span>Flagged for review</span>
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="mx-auto max-w-3xl rounded-3xl border-2 border-amber-100 bg-white p-6 shadow-sm md:p-8"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-800">
                  Question {currentQuestion + 1} of {totalQuestions}
                </span>
                <span className="rounded-full bg-sky-100 px-3 py-1 font-bold text-sky-700">{question.marks} marks</span>
                {question.difficulty && (
                  <span
                    className={`rounded-full px-3 py-1 font-bold capitalize ${
                      question.difficulty === "hard"
                        ? "bg-rose-100 text-rose-600"
                        : question.difficulty === "medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {question.difficulty}
                  </span>
                )}
                <button
                  onClick={toggleFlag}
                  className={`ml-auto flex items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-bold transition-all ${
                    flagged.has(currentQuestion)
                      ? "border-amber-400 bg-amber-100 text-amber-700"
                      : "border-amber-100 text-gray-400 hover:border-amber-300 hover:text-amber-600"
                  }`}
                >
                  <Flag className={`h-3.5 w-3.5 ${flagged.has(currentQuestion) ? "fill-amber-400" : ""}`} />
                  {flagged.has(currentQuestion) ? "Flagged" : "Flag"}
                </button>
              </div>

              <h2 className="mb-6 text-xl font-bold leading-relaxed text-gray-900">{question.text}</h2>

              {question.question_type === "multiple_choice" ||
              question.question_type === "single_choice" ? (
                <div className="space-y-3">
                  {question.options?.map((option: string, i: number) => (
                    <motion.label
                      key={i}
                      whileTap={{ scale: 0.99 }}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-all ${
                        answers[question.id] === option
                          ? "border-orange-400 bg-orange-50 shadow-md shadow-orange-100"
                          : "border-amber-100 hover:border-orange-300 hover:bg-amber-50/50"
                      }`}
                    >
                      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                        answers[question.id] === option
                          ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white"
                          : "bg-amber-100 text-gray-500"
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <input
                        type={
                          question.question_type === "single_choice"
                            ? "radio"
                            : "checkbox"
                        }
                        name={`q-${question.id}`}
                        checked={answers[question.id] === option}
                        onChange={() => handleAnswerChange(question.id, option)}
                        className="sr-only"
                      />
                      <span className="font-medium text-gray-800">{option}</span>
                    </motion.label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={answers[question.id] || ""}
                  onChange={(e) =>
                    handleAnswerChange(question.id, e.target.value)
                  }
                  className="h-40 w-full resize-none rounded-2xl border-2 border-amber-100 bg-amber-50/40 p-4 outline-none transition-all placeholder:text-gray-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  placeholder="Type your brilliant answer here..."
                />
              )}

              {/* Navigation buttons */}
              <div className="mt-8 flex items-center justify-between border-t-2 border-dashed border-amber-100 pt-6">
                <button
                  onClick={() => handleQuestionChange(currentQuestion - 1)}
                  disabled={currentQuestion === 0}
                  className="flex items-center gap-1 rounded-full border-2 border-amber-200 px-5 py-2 text-sm font-bold text-gray-600 transition-all hover:border-orange-400 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>

                <button
                  onClick={() => {
                    if (currentQuestion < totalQuestions - 1) {
                      handleQuestionChange(currentQuestion + 1);
                    }
                  }}
                  disabled={currentQuestion === totalQuestions - 1}
                  className="flex items-center gap-1 rounded-full bg-gray-900 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Submit confirmation */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border-2 border-amber-100 bg-white p-8 text-center shadow-2xl"
            >
              <OwlMascot className="mx-auto h-20 w-20" />
              <h3 className="mt-3 text-xl font-extrabold text-gray-900">Submit your exam?</h3>
              <p className="mt-2 text-sm text-gray-500">
                You answered <span className="font-bold text-emerald-600">{answeredCount}</span> of{" "}
                <span className="font-bold">{totalQuestions}</span> questions.
                {flagged.size > 0 && (
                  <span className="font-bold text-amber-600"> {flagged.size} flagged.</span>
                )}
                {answeredCount < totalQuestions && " Unanswered ones stay blank!"}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-xl border-2 border-amber-200 py-2.5 font-bold text-gray-600 transition-all hover:border-orange-300"
                >
                  Keep going
                </button>
                <button
                  onClick={() => { setShowConfirm(false); handleSubmit(); }}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 font-bold text-white shadow-md disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
