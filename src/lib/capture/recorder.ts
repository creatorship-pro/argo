/**
 * Browser recording for the FDE iPad. Browser-only code; the rules that can be
 * tested without a browser live in upload-queue.ts and here in pickMimeType.
 *
 * Each segment is its own complete recording (a fresh MediaRecorder on the same
 * microphone stream), so it can be transcribed on its own. Data is gathered in
 * one-second slices (never 100 ms or less: Safari 26 returns empty chunks), the
 * file type is never hard-coded, and the turn timer is the caller's own clock
 * because slice timing drifts.
 */
export const SEGMENT_MS = 45_000;
export const SLICE_MS = 1_000;
const MIN_BYTES = 2_000;

const PREFERRED = [
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

export function pickMimeType(
  isSupported: (type: string) => boolean,
): string | undefined {
  return PREFERRED.find((t) => isSupported(t));
}

export class SegmentRecorder {
  private current: MediaRecorder | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private mime: string | undefined;

  constructor(
    private stream: MediaStream,
    private onSegment: (blob: Blob) => void,
    private segmentMs = SEGMENT_MS,
  ) {
    this.mime =
      typeof MediaRecorder !== "undefined"
        ? pickMimeType((t) => MediaRecorder.isTypeSupported(t))
        : undefined;
  }

  start() {
    this.begin();
    this.timer = setInterval(() => this.cut(), this.segmentMs);
  }

  private begin() {
    const rec = new MediaRecorder(
      this.stream,
      this.mime ? { mimeType: this.mime } : undefined,
    );
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, {
        type: rec.mimeType || this.mime || "audio/mp4",
      });
      if (blob.size >= MIN_BYTES) this.onSegment(blob);
    };
    rec.start(SLICE_MS);
    this.current = rec;
  }

  /** Starts the next recording before stopping the last, so no speech falls in the gap. */
  private cut() {
    const prev = this.current;
    this.begin();
    prev?.stop();
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const last = this.current;
    this.current = null;
    if (last && last.state !== "inactive") {
      await new Promise<void>((resolve) => {
        const prior = last.onstop;
        last.onstop = (ev) => {
          prior?.call(last, ev);
          resolve();
        };
        last.stop();
      });
    }
    this.stream.getTracks().forEach((t) => t.stop());
  }
}

/** Keeps the iPad screen awake while recording. Best effort; needs the Home Screen install on iOS. */
export async function keepAwake(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: {
        request(type: "screen"): Promise<{ release(): Promise<void> }>;
      };
    };
    const lock = await nav.wakeLock?.request("screen");
    return () => void lock?.release().catch(() => {});
  } catch {
    return () => {};
  }
}
