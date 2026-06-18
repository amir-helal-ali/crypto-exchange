"use client";

import { useEffect, useRef } from "react";

/**
 * Sound notification manager for trading events.
 * Uses Web Audio API to generate simple tones (no external sound files needed).
 * Sounds: order_placed, order_filled, order_cancelled, error
 */

type SoundType =
  | "order_placed"
  | "order_filled"
  | "order_cancelled"
  | "error"
  | "tick";

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.enabled = localStorage.getItem("exchange_sound_enabled") !== "false";
      } catch {
        this.enabled = true;
      }
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    try {
      localStorage.setItem("exchange_sound_enabled", enabled.toString());
    } catch {}
  }

  isEnabled() {
    return this.enabled;
  }

  private getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.audioCtx) {
      try {
        const AC =
          window.AudioContext ||
          (window as any).webkitAudioContext;
        this.audioCtx = new AC();
      } catch {
        return null;
      }
    }
    return this.audioCtx;
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume: number = 0.1
  ) {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    if (!ctx) return;

    // Resume if suspended (browser autoplay policy)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + duration
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  play(sound: SoundType) {
    switch (sound) {
      case "order_placed":
        // Single rising tone
        this.playTone(440, 0.1, "sine", 0.08);
        setTimeout(() => this.playTone(660, 0.1, "sine", 0.08), 80);
        break;
      case "order_filled":
        // Happy triad
        this.playTone(523.25, 0.1, "sine", 0.1); // C5
        setTimeout(() => this.playTone(659.25, 0.1, "sine", 0.1), 80); // E5
        setTimeout(() => this.playTone(783.99, 0.15, "sine", 0.1), 160); // G5
        break;
      case "order_cancelled":
        // Descending tone
        this.playTone(330, 0.12, "triangle", 0.08);
        setTimeout(() => this.playTone(220, 0.15, "triangle", 0.08), 100);
        break;
      case "error":
        // Low buzz
        this.playTone(150, 0.3, "sawtooth", 0.08);
        break;
      case "tick":
        // Very short soft tick
        this.playTone(800, 0.03, "sine", 0.04);
        break;
    }
  }
}

let soundManager: SoundManager | null = null;

export function getSoundManager(): SoundManager {
  if (!soundManager) {
    soundManager = new SoundManager();
  }
  return soundManager;
}

/**
 * Hook to register keyboard shortcuts on the trading page:
 * - Ctrl+B: Toggle Buy side
 * - Ctrl+S: Toggle Sell side
 * - Ctrl+M: Switch to Market order type
 * - Ctrl+L: Switch to Limit order type
 * - Esc: Close any open dropdown/modal
 */
export function useKeyboardShortcuts(handlers: {
  onToggleSide?: () => void;
  onSetBuy?: () => void;
  onSetSell?: () => void;
  onSetMarket?: () => void;
  onSetLimit?: () => void;
  onSubmitOrder?: () => void;
  onCancelLast?: () => void;
}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in input/textarea
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        // Allow Ctrl+Enter to submit order even from input fields
        if (e.ctrlKey && e.key === "Enter") {
          e.preventDefault();
          handlersRef.current.onSubmitOrder?.();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            handlersRef.current.onSetBuy?.();
            break;
          case "s":
            e.preventDefault();
            handlersRef.current.onSetSell?.();
            break;
          case "m":
            e.preventDefault();
            handlersRef.current.onSetMarket?.();
            break;
          case "l":
            e.preventDefault();
            handlersRef.current.onSetLimit?.();
            break;
          case "enter":
            e.preventDefault();
            handlersRef.current.onSubmitOrder?.();
            break;
        }
        return;
      }

      switch (e.key) {
        case "Escape":
          // Close dropdowns via custom event
          window.dispatchEvent(new CustomEvent("exchange:escape"));
          break;
        case " ":
          // Spacebar toggles buy/sell
          e.preventDefault();
          handlersRef.current.onToggleSide?.();
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
