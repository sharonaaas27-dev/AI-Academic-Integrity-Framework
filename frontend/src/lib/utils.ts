import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0) parts.push(`${s}s`);
  return parts.join(" ") || "0s";
}

export function getRiskLevelColor(level: string): string {
  const colors: Record<string, string> = {
    safe: "text-green-600 bg-green-50 border-green-200",
    low: "text-yellow-600 bg-yellow-50 border-yellow-200",
    medium: "text-orange-600 bg-orange-50 border-orange-200",
    high: "text-red-600 bg-red-50 border-red-200",
    critical: "text-red-700 bg-red-100 border-red-300 animate-pulse",
  };
  return colors[level] || colors.safe;
}

export function getRiskScoreColor(score: number): string {
  if (score <= 20) return "text-green-600";
  if (score <= 40) return "text-yellow-600";
  if (score <= 60) return "text-orange-600";
  if (score <= 80) return "text-red-600";
  return "text-red-700";
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function generateSessionId(): string {
  return crypto.randomUUID();
}
