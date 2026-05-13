"use client";

/**
 * AudioRecorder — gravação de mensagem de voz no CRM (estilo WhatsApp).
 *
 * Engine: **opus-recorder** (client-side OGG/opus). Não usamos MediaRecorder
 * porque WhatsApp/Uazapi só renderiza PTT (balão de voz) com container OGG +
 * codec libopus. O encoder roda num Web Worker (`/public/opus/encoderWorker.min.js`)
 * com parâmetros `application=voip`, 32 kbps, 48 kHz, mono — mesmo profile do
 * WhatsApp nativo. Saída é OGG/opus pronto pra envio.
 *
 * Por que não MediaRecorder: o Chrome grava `audio/webm;codecs=opus`. Mesmo
 * que o codec opus seja o mesmo, o container webm faz o WhatsApp tratar como
 * arquivo anexo. Conversão webm→ogg server-side com ffmpeg quebra em
 * Cloudflare Workers (sem `child_process.spawn`).
 *
 * Estados: idle → recording → (paused?) → preview → sending → idle
 * Cleanup obrigatório: `recorder.close()` ao desmontar/cancelar/enviar.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Trash2, RotateCcw, Play, Pause, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface AudioRecorderProps {
  conversationId: string;
  disabled?: boolean;
  onSent: (message: unknown) => void;
  onActiveChange?: (active: boolean) => void;
}

const MAX_DURATION_SEC = 5 * 60;

// Types em src/types/opus-recorder.d.ts
import type Recorder from "opus-recorder";
type OpusRecorderInstance = InstanceType<typeof Recorder>;

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

type State = "idle" | "recording" | "paused" | "preview" | "sending";

export function AudioRecorder({
  conversationId,
  disabled,
  onSent,
  onActiveChange,
}: AudioRecorderProps) {
  const [state, setState] = useState<State>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recorderRef = useRef<OpusRecorderInstance | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    onActiveChange?.(
      state === "recording" || state === "paused" || state === "preview" || state === "sending"
    );
  }, [state, onActiveChange]);

  const cleanupRecorder = useCallback(() => {
    const rec = recorderRef.current;
    if (rec) {
      try { rec.close(); } catch { /* noop */ }
    }
    recorderRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanupRecorder();
      if (tickRef.current) clearInterval(tickRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startTick() {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= MAX_DURATION_SEC) {
          stopRecording();
          return MAX_DURATION_SEC;
        }
        return next;
      });
    }, 1000);
  }

  function stopTick() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  async function startRecording() {
    if (disabled) return;

    let RecorderCtor: typeof Recorder;
    try {
      const mod = await import("opus-recorder");
      RecorderCtor = mod.default;
    } catch (e) {
      console.error("[AudioRecorder] falha ao carregar opus-recorder:", e);
      toast.error("Seu navegador não suporta gravação de áudio");
      return;
    }

    try {
      const recorder = new RecorderCtor({
        encoderPath: "/opus/encoderWorker.min.js",
        encoderApplication: 2048, // voip
        encoderSampleRate: 48000,
        numberOfChannels: 1,
        encoderBitRate: 32000,
        streamPages: false, // entrega um único blob OGG no final
        monitorGain: 0,
        recordingGain: 1,
        resampleQuality: 3,
      });

      recorder.ondataavailable = (data: Uint8Array) => {
        stopTick();
        if (cancelledRef.current) {
          return;
        }
        if (!data || data.byteLength === 0) {
          toast.error("Áudio vazio");
          setState("idle");
          return;
        }
        // Cópia pra ArrayBuffer concreto — TS/Blob não aceita Uint8Array<SharedArrayBuffer>
        const buffer = new Uint8Array(data.byteLength);
        buffer.set(data);
        const blob = new Blob([buffer.buffer], { type: "audio/ogg" });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setState("preview");
      };

      recorderRef.current = recorder;
      cancelledRef.current = false;

      await recorder.start();

      // Plug AnalyserNode no source do opus-recorder pra waveform em tempo real.
      // opus-recorder já criou AudioContext + MediaStreamAudioSourceNode internamente.
      try {
        const ctx = recorder.audioContext;
        const source = recorder.sourceNode;
        if (ctx && source) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.7;
          source.connect(analyser);
          analyserRef.current = analyser;
        }
      } catch {
        // sem waveform; gravação segue normal
      }

      setElapsed(0);
      startTick();
      setState("recording");
    } catch (e) {
      const err = e as Error;
      if (err?.name === "NotAllowedError" || /permission/i.test(err?.message ?? "")) {
        toast.error("Permissão de microfone negada");
      } else {
        console.error("[AudioRecorder] start falhou:", err);
        toast.error("Não foi possível acessar o microfone");
      }
      cleanupRecorder();
      setState("idle");
    }
  }

  function pauseRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      rec.pause();
      stopTick();
      setState("paused");
    } catch { /* noop */ }
  }

  function resumeRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      rec.resume();
      startTick();
      setState("recording");
    } catch { /* noop */ }
  }

  function stopRecording() {
    const rec = recorderRef.current;
    if (!rec) return;
    cancelledRef.current = false;
    try {
      rec.stop(); // dispara ondataavailable + onstop
    } catch { /* noop */ }
  }

  function cancelRecording() {
    cancelledRef.current = true;
    stopTick();
    cleanupRecorder();
    blobRef.current = null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setElapsed(0);
    setState("idle");
  }

  async function rerecord() {
    cleanupRecorder();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    blobRef.current = null;
    setElapsed(0);
    await startRecording();
  }

  function sendFromRecording() {
    stopRecording();
  }

  async function sendRecording() {
    const blob = blobRef.current;
    if (!blob) return;
    setState("sending");
    try {
      const dataUri = await blobToDataUri(blob);
      const res = await fetch(`/api/crm/${conversationId}/send-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: dataUri,
          fileName: `audio-${Date.now()}.ogg`,
          isAudio: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(`Falhou: ${data.error ?? "erro ao enviar áudio"}`);
        setState("preview");
        return;
      }
      const data = await res.json();
      onSent(data.message);

      cleanupRecorder();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      blobRef.current = null;
      setElapsed(0);
      setState("idle");
    } catch (e) {
      toast.error(`Erro: ${e instanceof Error ? e.message : "rede"}`);
      setState("preview");
    }
  }

  if (state === "idle") {
    return (
      <button
        onClick={startRecording}
        disabled={disabled}
        className="p-2.5 text-muted hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
        title="Gravar áudio"
        aria-label="Gravar áudio"
      >
        <Mic className="w-4 h-4" />
      </button>
    );
  }

  if (state === "recording" || state === "paused") {
    const isPaused = state === "paused";
    return (
      <div className="flex-1 flex items-center gap-2 bg-surface border border-border rounded-full pl-2 pr-1.5 py-1.5">
        <button
          onClick={cancelRecording}
          aria-label="Descartar gravação"
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
          title="Descartar"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <span className="relative flex shrink-0 items-center justify-center w-2.5 h-2.5" aria-hidden>
          {!isPaused && (
            <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-error opacity-60 animate-ping" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-error" />
        </span>

        <span
          className="text-xs text-foreground tabular-nums font-medium shrink-0"
          aria-live="polite"
          aria-label={`Duração: ${fmtTime(elapsed)}`}
        >
          {fmtTime(elapsed)}
        </span>

        <Waveform analyser={analyserRef.current} active={!isPaused} />

        <span
          className="shrink-0 hidden sm:flex items-center gap-0.5 text-[10px] font-medium text-muted px-1.5 py-0.5 rounded-full border border-border"
          aria-hidden
          title="Velocidade de reprodução (após enviar)"
        >
          <Timer className="w-2.5 h-2.5" />
          1x
        </span>

        <button
          onClick={isPaused ? resumeRecording : pauseRecording}
          aria-label={isPaused ? "Retomar gravação" : "Pausar gravação"}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
          title={isPaused ? "Retomar" : "Pausar"}
        >
          {isPaused ? <Play className="w-4 h-4 ml-0.5" /> : <Pause className="w-4 h-4" />}
        </button>

        <button
          onClick={sendFromRecording}
          aria-label="Concluir e enviar áudio"
          className="shrink-0 w-10 h-10 rounded-full bg-white text-background hover:bg-white/90 transition-colors cursor-pointer flex items-center justify-center shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          title="Concluir gravação"
        >
          <Send className="w-4 h-4 fill-current" strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  if (state === "preview" || state === "sending") {
    return (
      <div className="flex-1 flex items-center gap-1.5 bg-surface-2 border border-border rounded-lg pl-2 pr-1.5 py-1.5">
        <button
          onClick={cancelRecording}
          disabled={state === "sending"}
          aria-label="Descartar gravação"
          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Descartar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {previewUrl && <PreviewPlayer src={previewUrl} disabled={state === "sending"} />}

        <button
          onClick={rerecord}
          disabled={state === "sending"}
          aria-label="Re-gravar"
          className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Re-gravar"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={sendRecording}
          disabled={state === "sending"}
          aria-label="Enviar áudio"
          className={cn(
            "shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-md hover:bg-primary-hover transition-colors cursor-pointer flex items-center justify-center",
            state === "sending" && "opacity-70 cursor-wait"
          )}
          title="Enviar"
        >
          {state === "sending" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    );
  }

  return null;
}

function Waveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const historyRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!active || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let cssW = 0;
    let cssH = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();

    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);
    const computedColor = getComputedStyle(canvas).color || "#fff";
    const BAR_WIDTH = 1.5;
    const BAR_GAP = 1.5;
    const STEP = BAR_WIDTH + BAR_GAP;

    function draw() {
      if (!analyser || !ctx || !canvas) return;
      analyser.getByteFrequencyData(data);

      const usefulBins = Math.floor(bufferLength * 0.45);
      let sum = 0;
      for (let i = 0; i < usefulBins; i++) sum += data[i] ?? 0;
      const avg = sum / usefulBins / 255;

      const maxBars = Math.max(20, Math.floor(cssW / STEP));
      historyRef.current.push(avg);
      if (historyRef.current.length > maxBars) {
        historyRef.current.splice(0, historyRef.current.length - maxBars);
      }

      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = computedColor;

      const hist = historyRef.current;
      const startX = cssW - hist.length * STEP;
      for (let i = 0; i < hist.length; i++) {
        const amp = hist[i] ?? 0;
        const h = Math.max(2, amp * cssH * 0.9);
        const x = startX + i * STEP;
        const y = (cssH - h) / 2;
        const r = BAR_WIDTH / 2;
        ctx.beginPath();
        ctx.roundRect?.(x, y, BAR_WIDTH, h, r);
        if (!ctx.roundRect) {
          ctx.rect(x, y, BAR_WIDTH, h);
        }
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, active]);

  return <canvas ref={canvasRef} className="flex-1 h-6 min-w-0 text-foreground" />;
}

function PreviewPlayer({ src, disabled }: { src: string; disabled?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    const onMeta = () => setDuration(Number.isFinite(a.duration) ? a.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setCurrentTime(0);
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [src]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  return (
    <div className="flex-1 flex items-center gap-2 min-w-0">
      <button
        onClick={toggle}
        disabled={disabled}
        aria-label={playing ? "Pausar prévia" : "Reproduzir prévia"}
        className="shrink-0 w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-100"
            style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
          />
        </div>
        <span className="text-[11px] tabular-nums text-muted shrink-0">
          {fmtTime(Math.floor(playing ? currentTime : duration))}
        </span>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
