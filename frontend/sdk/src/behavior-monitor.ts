/**
 * AI Academic Integrity Framework
 * Behavior Monitoring SDK
 *
 * Privacy-first behavioral tracking SDK for online examinations.
 * Captures mouse, keyboard, focus, and environment events without webcam.
 * Buffers events and sends in batches to the backend API.
 */

export interface BehaviorConfig {
  apiUrl: string;
  wsUrl?: string;
  examId: string;
  studentId: string;
  sessionId: string;
  flushInterval?: number;
  maxBufferSize?: number;
  heartbeatInterval?: number;
  offlineBufferKey?: string;
  debug?: boolean;
}

export interface BehaviorEvent {
  event_id?: string;
  event_type: string;
  timestamp: number;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface EventBatch {
  batch_id: string;
  exam_id: string;
  student_id: string;
  session_id: string;
  events: BehaviorEvent[];
  client_sent_at: number;
}

type EventHandler = (event: BehaviorEvent) => void;

export class BehaviorMonitor {
  private config: BehaviorConfig;
  private buffer: BehaviorEvent[] = [];
  private ws: WebSocket | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isFullscreen: boolean = false;
  private lastMousePos = { x: 0, y: 0, time: 0 };
  private lastKeyTime = 0;
  private isDevtoolsOpen = false;
  private networkOnline = true;
  private retryCount = 0;
  private maxRetries = 5;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private debug: boolean;

  constructor(config: BehaviorConfig) {
    this.config = {
      flushInterval: 5000,
      maxBufferSize: 100,
      heartbeatInterval: 10000,
      offlineBufferKey: 'behavior_offline',
      debug: false,
      ...config,
    };
    this.debug = this.config.debug;
  }

  /**
   * Initialize the monitor: bind events, start timers, connect WebSocket.
   */
  init(): void {
    this.log('Initializing BehaviorMonitor');
    this.bindMouseEvents();
    this.bindKeyboardEvents();
    this.bindFocusEvents();
    this.bindClipboardEvents();
    this.bindFullscreenEvents();
    this.bindNavigationEvents();
    this.bindDevtoolsDetection();
    this.bindNetworkEvents();
    this.bindTabVisibility();
    this.bindResizeEvents();

    this.startFlushTimer();
    this.startHeartbeat();
    this.connectWebSocket();

    this.emit('ready', {
      event_type: 'monitor_ready',
      timestamp: Date.now(),
      data: { userAgent: navigator.userAgent },
    });
  }

  /**
   * Destroy the monitor: unbind events, clear timers, flush remaining.
   */
  destroy(): void {
    this.log('Destroying BehaviorMonitor');
    this.flush();
    this.stopFlushTimer();
    this.stopHeartbeat();
    this.disconnectWebSocket();
    this.unbindEvents();
  }

  /**
   * Manually flush buffer to server.
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch: EventBatch = {
      batch_id: this.generateId(),
      exam_id: this.config.examId,
      student_id: this.config.studentId,
      session_id: this.config.sessionId,
      events: [...this.buffer],
      client_sent_at: Date.now(),
    };

    this.buffer = [];

    try {
      if (this.networkOnline) {
        await this.sendBatch(batch);
      } else {
        this.storeOffline(batch);
      }
    } catch (error) {
      this.log('Flush failed, storing offline:', error);
      this.storeOffline(batch);
    }
  }

  /**
   * Subscribe to specific event types for real-time handling.
   */
  on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Unsubscribe from event type.
   */
  off(eventType: string, handler: EventHandler): void {
    this.eventHandlers.get(eventType)?.delete(handler);
  }

  // ===================== PRIVATE METHODS =====================

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[BehaviorMonitor]', ...args);
    }
  }

  private generateId(): string {
    return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private captureEvent(
    eventType: string,
    data: Record<string, unknown> = {}
  ): void {
    const event: BehaviorEvent = {
      event_type: eventType,
      timestamp: Date.now(),
      data: {
        ...data,
        url: window.location.href,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      },
      metadata: {
        sdkVersion: '1.0.0',
      },
    };

    this.buffer.push(event);
    this.emit(eventType, event);

    if (this.buffer.length >= this.config.maxBufferSize!) {
      this.flush();
    }
  }

  private emit(eventType: string, event: BehaviorEvent): void {
    this.eventHandlers.get(eventType)?.forEach((handler) => handler(event));
  }

  // ===================== EVENT BINDINGS =====================

  private bindMouseEvents(): void {
    document.addEventListener('mousemove', (e: MouseEvent) => {
      const now = Date.now();
      const dt = now - this.lastMousePos.time;
      const dx = e.clientX - this.lastMousePos.x;
      const dy = e.clientY - this.lastMousePos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const velocity = dt > 0 ? dist / dt : 0;

      this.captureEvent('mouse_move', {
        x: e.clientX,
        y: e.clientY,
        dx,
        dy,
        velocity: Math.round(velocity * 100) / 100,
        timestamp: now,
      });

      this.lastMousePos = { x: e.clientX, y: e.clientY, time: now };
    });

    document.addEventListener('mousedown', (e: MouseEvent) => {
      this.captureEvent('mouse_click', {
        x: e.clientX,
        y: e.clientY,
        button: e.button,
        target: (e.target as HTMLElement)?.tagName || 'unknown',
      });
    });

    // Idle detection
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdle = (): void => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        this.captureEvent('mouse_idle', {
          duration: 30000,
          lastActivity: Date.now(),
        });
      }, 30000);
    };

    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(
      (event) => document.addEventListener(event, resetIdle)
    );
  }

  private bindKeyboardEvents(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const now = Date.now();
      const interval = this.lastKeyTime > 0 ? now - this.lastKeyTime : 0;
      this.lastKeyTime = now;

      const isSpecialKey = [
        'Control', 'Shift', 'Alt', 'Meta', 'Tab', 'Escape',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
      ].includes(e.key);

      if (e.key === 'Alt' || e.key === 'Tab') {
        this.captureEvent('alt_tab', { altKey: e.altKey, key: e.key });
      }

      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
        this.captureEvent('devtools_open', { method: 'keyboard_shortcut' });
      }

      this.captureEvent('key_down', {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
        repeat: e.repeat,
        interval,
      });
    });
  }

  private bindFocusEvents(): void {
    window.addEventListener('blur', () => {
      this.captureEvent('window_blur', { timestamp: Date.now() });
    });

    window.addEventListener('focus', () => {
      this.captureEvent('window_focus', {
        timestamp: Date.now(),
        awayDuration: Date.now() - (window as any).__lastBlurTime || 0,
      });
    });

    // Track blur duration
    window.addEventListener('blur', () => {
      (window as any).__lastBlurTime = Date.now();
    });
  }

  private bindClipboardEvents(): void {
    document.addEventListener('copy', (e: ClipboardEvent) => {
      this.captureEvent('key_copy', {
        selection: (window.getSelection()?.toString() || '').length,
      });
    });

    document.addEventListener('paste', (e: ClipboardEvent) => {
      this.captureEvent('key_paste', {
        contentLength: e.clipboardData?.getData('text')?.length || 0,
      });
    });

    document.addEventListener('cut', () => {
      this.captureEvent('key_cut', { timestamp: Date.now() });
    });
  }

  private bindFullscreenEvents(): void {
    document.addEventListener('fullscreenchange', () => {
      this.isFullscreen = !!document.fullscreenElement;
      if (!this.isFullscreen) {
        this.captureEvent('fullscreen_exit', { timestamp: Date.now() });
      }
    });

    document.addEventListener('webkitfullscreenchange', () => {
      this.isFullscreen = !!(document as any).webkitFullscreenElement;
      if (!this.isFullscreen) {
        this.captureEvent('fullscreen_exit', { timestamp: Date.now() });
      }
    });
  }

  private bindNavigationEvents(): void {
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        this.captureEvent('navigation', {
          from: lastUrl,
          to: window.location.href,
        });
        lastUrl = window.location.href;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('beforeunload', () => {
      this.captureEvent('refresh', { timestamp: Date.now() });
      this.flush();
    });

    window.addEventListener('popstate', () => {
      this.captureEvent('navigation', {
        from: lastUrl,
        to: window.location.href,
      });
      lastUrl = window.location.href;
    });
  }

  private bindDevtoolsDetection(): void {
    // Detect DevTools via element inspection
    const checkDevTools = (): void => {
      const threshold = 160;
      const widthThreshold = window.outerWidth - window.innerWidth > threshold;
      const heightThreshold = window.outerHeight - window.innerHeight > threshold;

      if (widthThreshold || heightThreshold) {
        if (!this.isDevtoolsOpen) {
          this.isDevtoolsOpen = true;
          this.captureEvent('devtools_open', {
            method: 'size_detection',
            outerWidth: window.outerWidth,
            innerWidth: window.innerWidth,
            outerHeight: window.outerHeight,
            innerHeight: window.innerHeight,
          });
        }
      } else {
        this.isDevtoolsOpen = false;
      }
    };

    setInterval(checkDevTools, 2000);

    // Firebug detection
    if ((window as any).firebug || (window as any).firebugVersion) {
      this.captureEvent('devtools_open', { method: 'firebug_detected' });
    }
  }

  private bindNetworkEvents(): void {
    window.addEventListener('online', () => {
      this.networkOnline = true;
      this.captureEvent('network_reconnect', { timestamp: Date.now() });
      this.flush(); // Flush offline buffer
    });

    window.addEventListener('offline', () => {
      this.networkOnline = false;
      this.captureEvent('network_disconnect', { timestamp: Date.now() });
    });
  }

  private bindTabVisibility(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.captureEvent('tab_hidden', { timestamp: Date.now() });
      } else {
        this.captureEvent('tab_visibility', { timestamp: Date.now() });
      }
    });
  }

  private bindResizeEvents(): void {
    let resizeTimer: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.captureEvent('browser_resize', {
          width: window.innerWidth,
          height: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
        });
      }, 500);
    });
  }

  // ===================== WEBSOCKET =====================

  private connectWebSocket(): void {
    if (!this.config.wsUrl && !this.config.apiUrl) return;

    const wsUrl =
      this.config.wsUrl ||
      this.config.apiUrl.replace(/^http/, 'ws') +
        `/api/v1/behavior/ws/${this.config.examId}/${this.config.studentId}/${this.config.sessionId}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.log('WebSocket connected');
        this.flush(); // Flush any buffered events
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.log('WS message:', data);
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.log('WebSocket disconnected');
        this.ws = null;
        // Reconnect after delay
        setTimeout(() => this.connectWebSocket(), 3000);
      };

      this.ws.onerror = (error) => {
        this.log('WebSocket error:', error);
      };
    } catch (error) {
      this.log('WebSocket connection failed:', error);
    }
  }

  private disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ===================== SENDING =====================

  private async sendBatch(batch: EventBatch): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/api/v1/behavior/events`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.retryCount = 0;
      this.log('Batch sent:', batch.events.length, 'events');
    } catch (error) {
      this.retryCount++;
      if (this.retryCount <= this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
        this.log('Retrying in', delay, 'ms');
        setTimeout(() => this.sendBatch(batch), delay);
      } else {
        this.log('Max retries reached, storing offline');
        this.storeOffline(batch);
      }
    }
  }

  // ===================== OFFLINE STORAGE =====================

  private storeOffline(batch: EventBatch): void {
    try {
      const stored = JSON.parse(
        localStorage.getItem(this.config.offlineBufferKey!) || '[]'
      );
      stored.push(batch);
      // Keep only last 50 batches
      while (stored.length > 50) stored.shift();
      localStorage.setItem(
        this.config.offlineBufferKey!,
        JSON.stringify(stored)
      );
      this.log('Stored offline:', batch.events.length, 'events');
    } catch {
      this.log('Failed to store offline');
    }
  }

  private async flushOfflineBuffer(): Promise<void> {
    try {
      const stored = JSON.parse(
        localStorage.getItem(this.config.offlineBufferKey!) || '[]'
      );
      if (stored.length === 0) return;

      localStorage.removeItem(this.config.offlineBufferKey!);

      for (const batch of stored) {
        await this.sendBatch(batch);
      }
    } catch {
      this.log('Failed to flush offline buffer');
    }
  }

  // ===================== HEARTBEAT =====================

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.captureEvent('heartbeat', {
        bufferSize: this.buffer.length,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        uptime: Date.now(),
      });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ===================== FLUSH TIMER =====================

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  // ===================== EVENT UNBINDING =====================

  private unbindEvents(): void {
    // Events are bound to document/window; real cleanup would track each listener
    this.stopFlushTimer();
    this.stopHeartbeat();
    this.disconnectWebSocket();
  }

  // ===================== EXAM INTEGRATION =====================

  /**
   * Called when a question is changed by the student.
   */
  trackQuestionChange(
    questionId: string,
    questionIndex: number,
    action: 'navigate' | 'answer' | 'revisit'
  ): void {
    this.captureEvent('question_navigate', {
      questionId,
      questionIndex,
      action,
    });
  }

  /**
   * Called when an answer is modified.
   */
  trackAnswerEdit(
    questionId: string,
    previousAnswer: string,
    newAnswer: string
  ): void {
    this.captureEvent('answer_change', {
      questionId,
      previousLength: previousAnswer?.length || 0,
      newLength: newAnswer?.length || 0,
    });
  }

  /**
   * Mark exam start.
   */
  trackExamStart(): void {
    this.captureEvent('exam_start', {
      timestamp: Date.now(),
      examId: this.config.examId,
    });
  }

  /**
   * Mark exam submission.
   */
  trackExamSubmit(): void {
    this.captureEvent('exam_submit', {
      timestamp: Date.now(),
      bufferSize: this.buffer.length,
    });
    this.flush();
  }
}

// Singleton export
let instance: BehaviorMonitor | null = null;

export function createBehaviorMonitor(config: BehaviorConfig): BehaviorMonitor {
  if (instance) {
    instance.destroy();
  }
  instance = new BehaviorMonitor(config);
  return instance;
}

export function getBehaviorMonitor(): BehaviorMonitor | null {
  return instance;
}
