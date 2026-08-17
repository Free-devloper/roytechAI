import type { ChatTurn, SseEvent } from "../../lib/assistant/types";

export type VoiceEvent = SseEvent;

export type VoiceContext = {
  history: ChatTurn[];
  leadName?: string | null;
  leadEmail?: string | null;
};

export type VoiceChannel = {
  mode: "websocket" | "stream";
  sendStart: (ctx: VoiceContext) => Promise<void>;
  sendUtterance: (audio: string, format: string, ctx: VoiceContext) => Promise<void>;
  close: () => void;
};

function voiceWsUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/assistant/voice`;
}

export async function parseSse(response: Response, onEvent: (event: VoiceEvent) => void) {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((item) => item.startsWith("data:"));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as VoiceEvent);
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

async function postVoice(body: Record<string, unknown>, onEvent: (event: VoiceEvent) => void) {
  const response = await fetch("/api/assistant/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.text()) || "Voice request failed");
  await parseSse(response, onEvent);
}

function openSocket(timeoutMs = 1200) {
  return new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(voiceWsUrl());
    const timer = window.setTimeout(() => {
      socket.close();
      reject(new Error("WebSocket timed out"));
    }, timeoutMs);
    socket.addEventListener("open", () => {
      window.clearTimeout(timer);
      resolve(socket);
    });
    socket.addEventListener("error", () => {
      window.clearTimeout(timer);
      reject(new Error("WebSocket unavailable"));
    });
  });
}

export async function connectVoiceChannel(onEvent: (event: VoiceEvent) => void): Promise<VoiceChannel> {
  try {
    const socket = await openSocket();
    let settle: ((error?: Error) => void) | null = null;
    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as VoiceEvent;
        onEvent(payload);
        if (payload.type === "done" || payload.type === "error") settle?.();
      } catch {
        // ignore
      }
    });
    socket.addEventListener("close", () => settle?.(new Error("Live call disconnected.")));
    const waitTurn = () =>
      new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error("Voice turn timed out.")), 90_000);
        settle = (error) => {
          window.clearTimeout(timer);
          settle = null;
          if (error) reject(error);
          else resolve();
        };
      });
    const sendFrame = async (frame: Record<string, unknown>) => {
      socket.send(JSON.stringify(frame));
      await waitTurn();
    };
    return {
      mode: "websocket",
      sendStart: (ctx) => sendFrame({ type: "start", action: "start", ...ctx }),
      sendUtterance: (audio, format, ctx) => sendFrame({ type: "utterance", action: "utterance", audio, format, ...ctx }),
      close: () => socket.close(),
    };
  } catch {
    return {
      mode: "stream",
      sendStart: (ctx) => postVoice({ action: "start", ...ctx }, onEvent),
      sendUtterance: (audio, format, ctx) => postVoice({ action: "utterance", audio, format, ...ctx }, onEvent),
      close: () => undefined,
    };
  }
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function playPcm16(bytes: Uint8Array, sampleRate: number) {
  const context = new AudioContext();
  try {
    const samples = Math.floor(bytes.byteLength / 2);
    const buffer = context.createBuffer(1, samples, sampleRate);
    const channel = buffer.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < samples; i += 1) channel[i] = view.getInt16(i * 2, true) / 32768;
    await context.resume();
    await new Promise<void>((resolve) => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => resolve();
      source.start();
    });
  } finally {
    await context.close();
  }
}

export async function playAudioClip(clip: { mime: string; data: string; rate?: number }) {
  const bytes = base64ToBytes(clip.data);
  if (clip.mime.includes("pcm") && !(bytes[0] === 0x52 && bytes[1] === 0x49)) {
    await playPcm16(bytes, clip.rate || 24000);
    return;
  }
  const mime = clip.mime.includes("wav") ? "audio/wav" : clip.mime.includes("pcm") ? "audio/wav" : "audio/mpeg";
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  try {
    const audio = new Audio(url);
    await audio.play();
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Could not play speech audio."));
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class AudioQueue {
  private queue: Array<{ mime: string; data: string; rate?: number }> = [];
  private playing = false;
  private stopped = false;
  onIdle: (() => void) | null = null;

  enqueue(clip: { mime: string; data: string; rate?: number }) {
    if (this.stopped) return;
    this.queue.push(clip);
    void this.pump();
  }

  stop() {
    this.stopped = true;
    this.queue = [];
  }

  get busy() {
    return this.playing || this.queue.length > 0;
  }

  private async pump() {
    if (this.playing) return;
    this.playing = true;
    while (this.queue.length && !this.stopped) {
      const clip = this.queue.shift();
      if (!clip) break;
      try {
        await playAudioClip(clip);
      } catch {
        // keep the call going if one clip fails
      }
    }
    this.playing = false;
    if (!this.stopped && this.queue.length === 0) this.onIdle?.();
  }
}

function pickRecorderMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return types.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) || "";
}

export function formatFromMime(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  return "webm";
}

export class MicCapture {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private armed = false;
  private speaking = false;
  private startedAt = 0;
  private silentFor = 0;
  private lastTs = 0;
  onUtterance: ((blob: Blob, format: string) => void) | null = null;
  readonly mime = pickRecorderMime();
  readonly format = formatFromMime(this.mime);

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.context = new AudioContext();
    const source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);
    this.arm();
    this.watch();
  }

  arm() {
    this.armed = true;
  }

  pause() {
    this.armed = false;
    this.speaking = false;
    this.silentFor = 0;
    this.stopRecorder(false);
  }

  stop() {
    this.pause();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.context?.close();
    this.context = null;
  }

  private watch() {
    const loop = (ts: number) => {
      this.raf = requestAnimationFrame(loop);
      if (!this.armed || !this.analyser) return;
      const data = new Uint8Array(this.analyser.fftSize);
      this.analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const sample of data) {
        const centered = (sample - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / data.length);
      const dt = this.lastTs ? Math.min(80, ts - this.lastTs) : 16;
      this.lastTs = ts;
      if (rms > 0.045) {
        if (!this.speaking) {
          this.speaking = true;
          this.startedAt = ts;
          this.startRecorder();
        }
        this.silentFor = 0;
      } else if (this.speaking) {
        this.silentFor += dt;
        const held = ts - this.startedAt;
        if ((this.silentFor > 900 && held > 650) || held > 12_000) {
          this.speaking = false;
          this.silentFor = 0;
          this.stopRecorder(true);
        }
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  private startRecorder() {
    if (!this.stream || this.recorder) return;
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size) this.chunks.push(event.data);
    };
    this.recorder.start();
  }

  private stopRecorder(emit: boolean) {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = null;
    recorder.onstop = () => {
      if (!emit || !this.chunks.length) return;
      const blob = new Blob(this.chunks, { type: recorder.mimeType || this.mime || "audio/webm" });
      this.chunks = [];
      if (blob.size > 1200) this.onUtterance?.(blob, this.format);
    };
    if (recorder.state !== "inactive") recorder.stop();
  }
}
