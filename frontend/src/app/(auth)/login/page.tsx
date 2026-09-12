"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Shield, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "@/lib/api";
import { AuthSideArt } from "@/components/illustrations/scenes";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const GOOGLE_CLIENT_ID =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  const routeByRole = (role: string) => {
    if (role === "admin" || role === "super_admin") router.push("/admin/dashboard");
    else if (role === "teacher" || role === "exam_controller") router.push("/teacher/dashboard");
    else router.push("/student/dashboard");
  };

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) => api.post("/api/v1/auth/login", data),
    onSuccess: (response: any) => {
      localStorage.setItem("access_token", response.access_token);
      localStorage.setItem("refresh_token", response.refresh_token);
      localStorage.setItem("user", JSON.stringify(response.user));
      toast.success("Welcome back! Login successful");
      routeByRole(response.user.role);
    },
    onError: (error: any) => {
      toast.error(error.message || "Login failed");
    },
  });

  const googleMutation = useMutation({
    mutationFn: (credential: string) =>
      api.post("/api/v1/auth/google", { credential }),
    onSuccess: (response: any) => {
      localStorage.setItem("access_token", response.access_token);
      localStorage.setItem("refresh_token", response.refresh_token);
      localStorage.setItem("user", JSON.stringify(response.user));
      toast.success("Google login successful");
      routeByRole(response.user.role);
    },
    onError: (error: any) => {
      toast.error(error.message || "Google login failed");
    },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="bg-campus flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="grid w-full max-w-4xl overflow-hidden rounded-3xl border-2 border-amber-100 bg-white shadow-2xl shadow-orange-100 md:grid-cols-2"
      >
        {/* form side */}
        <div className="p-8 md:p-10">
          <div className="mb-6 flex items-center gap-2">
            <span className="rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-1.5">
              <Shield className="h-5 w-5 text-white" />
            </span>
            <span className="font-extrabold text-gray-900">AI Academic Integrity</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900">Welcome back!</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your campus account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                Email
              </label>
              <input
                type="email"
                {...register("email")}
                className="w-full rounded-xl border-2 border-amber-100 bg-amber-50/40 px-4 py-2.5 outline-none transition-all placeholder:text-gray-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                placeholder="you@university.edu"
              />
              {errors.email && (
                <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="mt-1 text-sm font-medium text-rose-500">{errors.email.message}</motion.p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  className="w-full rounded-xl border-2 border-amber-100 bg-amber-50/40 px-4 py-2.5 pr-10 outline-none transition-all placeholder:text-gray-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-orange-500"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="mt-1 text-sm font-medium text-rose-500">
                  {errors.password.message}
                </motion.p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" className="h-4 w-4 rounded accent-orange-500" />
                <span className="text-gray-600">Remember me</span>
              </label>
              <a href="/forgot-password" className="font-semibold text-orange-600 hover:underline">
                Forgot password?
              </a>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loginMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-bold text-white shadow-lg shadow-orange-200 transition-all hover:shadow-xl hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loginMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : loginMutation.isSuccess ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : null}
              Sign In
            </motion.button>

            {GOOGLE_CLIENT_ID && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-amber-200" />
                  </div>
                  <div className="relative flex justify-center text-xs font-bold uppercase">
                    <span className="bg-white px-2 text-gray-400">Or continue with</span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={(credentialResponse) => {
                      if (credentialResponse.credential) {
                        googleMutation.mutate(credentialResponse.credential);
                      }
                    }}
                    onError={() => toast.error("Google login failed")}
                    size="large"
                    shape="pill"
                    text="signin_with"
                  />
                </div>
              </>
            )}

            <p className="text-center text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <a href="/register" className="font-bold text-orange-600 hover:underline">
                Create one
              </a>
            </p>
          </form>
        </div>

        {/* art side */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="hidden p-3 md:block"
        >
          <AuthSideArt />
        </motion.div>
      </motion.div>
    </div>
  );
}
