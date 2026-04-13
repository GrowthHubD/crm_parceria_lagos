"use client";

import { useCallback, useRef } from "react";

export type SoundType =
  | "pop"
  | "click"
  | "success"
  | "error"
  | "hover"
  | "notification"
  | "delete"
  | "save"
  | "open"
  | "toggle";

export function useUiSound() {
  const audioCtx = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtx.current;
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }, []);

  const playSynthesizedSound = useCallback((type: SoundType) => {
    try {
      const ctx = getCtx();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;

      switch (type) {
        case "pop":
          osc.type = "sine";
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;

        case "click":
          osc.type = "square";
          osc.frequency.setValueAtTime(150, now);
          gainNode.gain.setValueAtTime(0.05, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
          osc.start(now);
          osc.stop(now + 0.02);
          break;

        case "success":
          osc.type = "sine";
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(554.37, now + 0.1);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
          gainNode.gain.linearRampToValueAtTime(0.1, now + 0.1);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc.start(now);
          osc.stop(now + 0.3);
          break;

        case "error":
          osc.type = "triangle";
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.linearRampToValueAtTime(180, now + 0.2);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
          break;

        case "hover": {
          // Ultra-subtle ultra-short high-freq tick
          osc.type = "sine";
          osc.frequency.setValueAtTime(900, now);
          osc.frequency.exponentialRampToValueAtTime(700, now + 0.04);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.04, now + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
          break;
        }

        case "notification": {
          // Pleasant ascending 3-note arpeggio
          const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
          freqs.forEach((freq, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            const t = now + i * 0.1;
            o.type = "sine";
            o.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.12, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            o.start(t);
            o.stop(t + 0.18);
          });
          // Don't use the pre-created osc/gain, stop them silently
          gainNode.gain.setValueAtTime(0, now);
          osc.start(now);
          osc.stop(now + 0.001);
          return;
        }

        case "delete": {
          // Descending whoosh — triangle wave dropping in pitch
          osc.type = "triangle";
          osc.frequency.setValueAtTime(300, now);
          osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.12, now + 0.03);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
          break;
        }

        case "save": {
          // Satisfying two-click: first pop then slightly higher
          [0, 0.08].forEach((delay, i) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            const t = now + delay;
            o.type = "sine";
            o.frequency.setValueAtTime(i === 0 ? 500 : 620, t);
            o.frequency.exponentialRampToValueAtTime(i === 0 ? 650 : 780, t + 0.06);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.12, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
            o.start(t);
            o.stop(t + 0.1);
          });
          gainNode.gain.setValueAtTime(0, now);
          osc.start(now);
          osc.stop(now + 0.001);
          return;
        }

        case "open": {
          // Rising swoosh for modal/panel opening
          osc.type = "sine";
          osc.frequency.setValueAtTime(200, now);
          osc.frequency.exponentialRampToValueAtTime(480, now + 0.15);
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.1, now + 0.04);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.start(now);
          osc.stop(now + 0.18);
          break;
        }

        case "toggle": {
          // Mechanical tick — square wave transient
          osc.type = "square";
          osc.frequency.setValueAtTime(800, now);
          osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);
          gainNode.gain.setValueAtTime(0.06, now);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
          break;
        }
      }
    } catch (err) {
      console.warn("UI Sound failed to play", err);
    }
  }, [getCtx]);

  return { playSound: playSynthesizedSound };
}
