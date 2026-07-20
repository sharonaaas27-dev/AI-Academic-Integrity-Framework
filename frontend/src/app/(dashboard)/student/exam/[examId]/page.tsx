"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  Shield,
} from "lucide-react";
import { api } from "@/lib/api";
import { createBehaviorMonitor } from "@sdk/behavior-monitor";
import { generateSessionId } from "@/lib/utils";
import { toast } from "sonner";

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [examStarted, setExamStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
      apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
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

      toast.success("Exam submitted successfully");
      router.push("/student/dashboard");
    } catch (error) {
      toast.error("Failed to submit exam");
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white max-w-2xl w-full p-8 rounded-xl shadow-sm border space-y-6"
        >
          <Shield className="h-12 w-12 text-primary mx-auto" />
          <div className="text-center">
            <h1 className="text-2xl font-bold">{exam?.title}</h1>
            <p className="text-gray-600 mt-2">{exam?.description}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <h3 className="font-medium">Exam Instructions</h3>
            <ul className="space-y-1 text-gray-600">
              <li>• Duration: {exam?.duration_minutes} minutes</li>
              <li>• Questions: {exam?.questions?.length || 0}</li>
              <li>• Total Marks: {exam?.total_marks}</li>
              <li>• Passing Marks: {exam?.passing_marks}</li>
              {exam?.require_fullscreen && (
                <li className="text-amber-600">
                  • Fullscreen mode is required throughout the exam
                </li>
              )}
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <p>
              Your behavioral data (mouse movements, keyboard patterns, focus
              events) will be monitored for integrity purposes. No webcam or
              personal data is captured.
            </p>
          </div>

          <button
            onClick={startExam}
            className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90"
          >
            Start Exam
          </button>
        </motion.div>
      </div>
    );
  }

  if (!exam?.questions?.length) {
    return <div className="h-screen flex items-center justify-center">No questions found</div>;
  }

  const question = exam.questions[currentQuestion];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = exam.questions.length;
  const hours = Math.floor(timeRemaining / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Exam Header */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium">{exam?.title}</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-sm text-gray-600">
            {answeredCount}/{totalQuestions} answered
          </span>
          <span
            className={`flex items-center gap-1 font-mono text-lg ${
              timeRemaining < 300 ? "text-red-600 animate-pulse" : "text-gray-800"
            }`}
          >
            <Clock className="h-4 w-4" />
            {hours > 0 ? `${hours}:` : ""}
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Submit"
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Question Navigator */}
        <div className="w-64 bg-white border-r p-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-600 mb-3">
            Questions
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {exam.questions.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => handleQuestionChange(i)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                  currentQuestion === i
                    ? "bg-primary text-white"
                    : answers[exam.questions[i].id]
                      ? "bg-green-100 text-green-700 border border-green-300"
                      : "bg-gray-50 text-gray-600 border hover:bg-gray-100"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-primary" />
              <span>Current</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-50 border" />
              <span>Unanswered</span>
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <motion.div
            key={currentQuestion}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <span>
                Question {currentQuestion + 1} of {totalQuestions}
              </span>
              <span className="text-gray-300">|</span>
              <span>{question.marks} marks</span>
              {question.difficulty && (
                <>
                  <span className="text-gray-300">|</span>
                  <span
                    className={`capitalize ${
                      question.difficulty === "hard"
                        ? "text-red-500"
                        : question.difficulty === "medium"
                          ? "text-yellow-500"
                          : "text-green-500"
                    }`}
                  >
                    {question.difficulty}
                  </span>
                </>
              )}
            </div>

            <h2 className="text-xl font-medium mb-6">{question.text}</h2>

            {question.question_type === "multiple_choice" ||
            question.question_type === "single_choice" ? (
              <div className="space-y-3">
                {question.options?.map((option: string, i: number) => (
                  <label
                    key={i}
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      answers[question.id] === option
                        ? "border-primary bg-primary/5"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type={
                        question.question_type === "single_choice"
                          ? "radio"
                          : "checkbox"
                      }
                      name={`q-${question.id}`}
                      checked={answers[question.id] === option}
                      onChange={() => handleAnswerChange(question.id, option)}
                      className="text-primary focus:ring-primary"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[question.id] || ""}
                onChange={(e) =>
                  handleAnswerChange(question.id, e.target.value)
                }
                className="w-full h-40 p-4 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                placeholder="Type your answer here..."
              />
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <button
                onClick={() => handleQuestionChange(currentQuestion - 1)}
                disabled={currentQuestion === 0}
                className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="flex items-center gap-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
