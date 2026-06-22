/**
 * Admin live stream — single EventSource connection to /api/v1/admin/stream.
 *
 * Replaces ALL polling in the admin panel. The server pushes discrete event
 * types ("stats", "online", "tx", "users", "kyc") as they happen, plus a
 * heartbeat every 10s with a fresh stats snapshot.
 *
 * Usage:
 *   const unsub = adminStream.on("stats", (stats) => { ... });
 *   adminStream.on("tx",     (tx)     => { ... });
 *   adminStream.on("users",  (user)   => { ... });
 *   adminStream.on("kyc",    (kyc)    => { ... });
 *   adminStream.on("online", (online) => { ... });
 *   // later:
 *   unsub();
 *
 * The connection auto-reconnects with backoff. Token is read from
 * localStorage and refreshed automatically if expired.
 */

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type EventHandler = (data: any) => void;

class AdminStream {
  private es: EventSource | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private closed = false;
  private tokenRefreshInProgress = false;

  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  on(eventType: string, fn: EventHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(fn);
    this.ensureConnected();
    return () => {
      this.listeners.get(eventType)?.delete(fn);
    };
  }

  /** Get the current JWT (refreshing if needed). */
  private async getToken(): Promise<string | null> {
    if (typeof window === "undefined") return null;
    let token = localStorage.getItem("token");
    if (!token) return null;

    // Try to decode expiry — if < 30s left, refresh proactively
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const expMs = (payload.exp || 0) * 1000;
      if (expMs - Date.now() < 30_000) {
        if (this.tokenRefreshInProgress) {
          // Wait for in-flight refresh
          for (let i = 0; i < 10; i++) {
            await new Promise((r) => setTimeout(r, 200));
            const fresh = localStorage.getItem("token");
            if (fresh && fresh !== token) return fresh;
          }
          return null;
        }
        this.tokenRefreshInProgress = true;
        try {
          const refreshToken = localStorage.getItem("refresh_token");
          if (!refreshToken) return null;
          const res = await fetch(`${API}/api/v1/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          if (!res.ok) return null;
          const data = await res.json();
          localStorage.setItem("token", data.token);
          localStorage.setItem("refresh_token", data.refresh_token);
          localStorage.setItem("user", JSON.stringify(data.user));
          token = data.token;
        } catch {
          return null;
        } finally {
          this.tokenRefreshInProgress = false;
        }
      }
    } catch {
      // token not a JWT — try anyway
    }
    return token;
  }

  private async ensureConnected() {
    if (typeof window === "undefined") return;
    if (this.closed) return;
    if (this.es) return;
    if (this.reconnectTimer) return;

    const token = await this.getToken();
    if (!token) return;

    const types = Array.from(this.listeners.keys()).filter((t) => t !== "hello");
    const url = `${API}/api/v1/admin/stream?token=${encodeURIComponent(token)}&types=${encodeURIComponent(types.join(","))}`;

    try {
      const es = new EventSource(url);
      this.es = es;

      es.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      // Generic message handler — dispatch by event name
      const dispatch = (eventName: string, ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data);
          this.listeners.get(eventName)?.forEach((fn) => {
            try { fn(data); } catch {}
          });
        } catch {}
      };

      ["hello", "stats", "online", "tx", "users", "kyc"].forEach((evtName) => {
        es.addEventListener(evtName, (ev) => dispatch(evtName, ev as MessageEvent));
      });
      // Catch-all for any unnamed events (future-proof)
      es.onmessage = (ev) => dispatch("message", ev);

      es.onerror = () => {
        // EventSource auto-reconnects natively, but if the token expired
        // we need to rebuild the URL with a fresh one.
        try { es.close(); } catch {}
        this.es = null;
        if (this.closed) return;
        const delay = Math.min(1500 * Math.pow(1.5, this.reconnectAttempts), 15000);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.ensureConnected();
        }, delay);
      };
    } catch {
      this.es = null;
      if (this.closed) return;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.ensureConnected();
      }, 2000);
    }
  }

  /** Force-close (e.g. on logout). */
  close() {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.es) {
      try { this.es.close(); } catch {}
      this.es = null;
    }
  }
}

export const adminStream = new AdminStream();
