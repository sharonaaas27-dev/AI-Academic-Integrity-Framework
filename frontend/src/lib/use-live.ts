"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { liveSubscribeUrl } from "@/lib/api";

export type LiveMessage =
  | { type: "risk_updated"; student_id: string; risk_level: string; overall_score: number }
  | { type: "alert"; student_id: string; student_name: string; event_type: string }
  | { type: string; [k: string]: unknown };

/** Subscribe to teacher live-push for an exam.
 *  Messages only invalidate react-query caches — HTTP polling stays as
 *  the fallback, so a dropped socket never loses data. */
export function useLiveExam(examId: string | undefined) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!examId) return;
    let ws: WebSocket | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      const url = liveSubscribeUrl(examId);
      if (!url) return; // not logged in yet; polling covers us
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleRetry();
        return;
      }

      ws.onopen = () => {
        setConnected(true);
        retryRef.current = 0;
        if (pingRef.current) clearInterval(pingRef.current);
        pingRef.current = setInterval(() => {
          try { ws?.send(JSON.stringify({ ping: 1 })); } catch { /* reconnect handles */ }
        }, 20000);
      };

      ws.onmessage = (ev) => {
        let msg: LiveMessage;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "pong") return;
        if (msg.type === "risk_updated") {
          queryClient.invalidateQueries({ queryKey: ["live-students", examId] });
          queryClient.invalidateQueries({ queryKey: ["live-summary", examId] });
          queryClient.invalidateQueries({ queryKey: ["live-student-detail", examId] });
        } else if (msg.type === "alert") {
          queryClient.invalidateQueries({ queryKey: ["live-alerts", examId] });
          queryClient.invalidateQueries({ queryKey: ["live-summary", examId] });
          const label = String((msg as Record<string, unknown>).event_type || "activity").replace(/_/g, " ");
          toast.warning(`Suspicious activity: ${label}`, { duration: 4000 });
        }
      };

      const down = () => {
        setConnected(false);
        if (pingRef.current) clearInterval(pingRef.current);
        scheduleRetry();
      };
      ws.onclose = down;
      ws.onerror = down;
    };

    const scheduleRetry = () => {
      if (closed) return;
      const delay = Math.min(1000 * 2 ** retryRef.current, 15000);
      retryRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(connect, delay);
    };

    connect();
    return () => {
      closed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      try { ws?.close(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  return { liveConnected: connected };
}
