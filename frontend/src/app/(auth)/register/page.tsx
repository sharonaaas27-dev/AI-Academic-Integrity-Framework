"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Shield, Eye, EyeOff, Loader2, PartyPopper } from "lucide-react";
import { api } from "@/lib/api";
import { AuthSideArt } from "@/components/illustrations/scenes";

const registerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

function strength(pw: string): { label: string; pct: string; color: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 2) return { label: "Weak", pct: "w-1/4", color: "bg-rose-400" };
  if (s <= 3) return { label: "Okay", pct: "w-2/4", color: "bg-amber-400" };
  if (s <= 4) return { label: "Strong", pct: "w-3/4", color: "bg-teal-400" };
  return { label: "Superb!", pct: "w-full", color: "bg-emerald-500" };
}

const inputCls =
  "w-full rounded-xl border-2 border-amber-100 bg-amber-50/40 px-4 py-2.5 outline-none transition-all placeholder:text-gray-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });
  const pw = useWatch({ control, name: "password" }) || "";
  const st = strength(pw);

  const registerMutation = useMutation({
    mutationFn: (data: RegisterForm) =>
      api.post("/api/v1/auth/register", {
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        role: "student",
        institution_id: "00000000-0000-0000-0000-000000000001",
      }),
    onSuccess: () => {
      toast.success("Account created! Please sign in.");
      router.push("/login");
    },
    onError: (error: any) => {
      toast.error(error.message || "Registration failed");
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="bg-campus flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="grid w-full max-w-4xl overflow-hidden rounded-3xl border-2 border-amber-100 bg-white shadow-2xl shadow-orange-100 md:grid-cols-2"
      >
        <div className="p-8 md:p-10">
          <div className="mb-6 flex items-center gap-2">
            <span className="rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 p-1.5">
              <Shield className="h-5 w-5 text-white" />
            </span>
            <span className="font-extrabold text-gray-900">AI Academic Integrity</span>
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold text-gray-900">
            Join the campus! <PartyPopper className="h-6 w-6 text-orange-500" />
          </h1>
          <p className="mt-1 text-sm text-gray-500">Create your student account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">First Name</label>
                <input {...register("first_name")} className={inputCls} placeholder="John" />
                {errors.first_name && <p className="mt-1 text-sm font-medium text-rose-500">{errors.first_name.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Last Name</label>
                <input {...register("last_name")} className={inputCls} placeholder="Doe" />
                {errors.last_name && <p className="mt-1 text-sm font-medium text-rose-500">{errors.last_name.message}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Email</label>
              <input type="email" {...register("email")} className={inputCls} placeholder="you@university.edu" />
              {errors.email && <p className="mt-1 text-sm font-medium text-rose-500">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  className={`${inputCls} pr-10`}
                  placeholder="Min. 8 characters"
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
              {pw && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-amber-100">
                    <motion.div animate={{ width: undefined }} className={`h-full rounded-full ${st.color} ${st.pct} transition-all`} />
                  </div>
                  <span className="text-xs font-bold text-gray-500">{st.label}</span>
                </div>
              )}
              {errors.password && <p className="mt-1 text-sm font-medium text-rose-500">{errors.password.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-gray-700">Confirm Password</label>
              <input type="password" {...register("confirmPassword")} className={inputCls} placeholder="Repeat password" />
              {errors.confirmPassword && <p className="mt-1 text-sm font-medium text-rose-500">{errors.confirmPassword.message}</p>}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={registerMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-bold text-white shadow-lg shadow-orange-200 transition-all hover:shadow-xl hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {registerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create account
            </motion.button>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <a href="/login" className="font-bold text-orange-600 hover:underline">Sign in</a>
            </p>
          </form>
        </div>

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
