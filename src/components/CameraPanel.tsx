import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Video, VideoOff } from "lucide-react";
import type { Calibration, ColorId, Detection, HsvRef, Notice } from "../types";
import { COLOR_DEFS } from "../types";
import { buildLut, sampleAvgHsv } from "../lib/color";

const ANALYSIS_W = 384;
const GRID_STRIDE = 2;
const MIN_BLOB = 12; // Mindestfläche (Grid-Zellen ~ je 2×2 Analyse-Pixel)
const MAX_BLOB_SHARE = 0.25; // max. 25 % des Bildes → Schmutz aussortieren
const SIDE_MARGIN = 0.02; // Hysterese um die Linie (normiert)

interface RaceFlag {
  running: boolean;
}

interface Props {
  calibration: Calibration;
  tolerance: number;
  detecting: boolean;
  selectedColor: ColorId;
  linePos: number; // 0..1
  lineVertical: boolean;
  raceFlag: React.RefObject<RaceFlag>;
  notice: Notice;
  onCrossing: (id: ColorId) => void;
  onCalibrate: (id: ColorId, hsv: HsvRef) => void;
  onLive: (ids: ColorId[]) => void;
  onNotice: (n: Notice) => void;
  onCameraChange: (on: boolean) => void;
  getLaps: (id: ColorId) => number;
  getName: (id: ColorId) => string;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export default function CameraPanel(props: Props) {
  const { calibration, tolerance } = props;

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [res, setRes] = useState<{ w: number; h: number } | null>(null);
  const [fps, setFps] = useState(0);
  const [liveCount, setLiveCount] = useState(0);

  // ---- Refs für den Analyse-Loop (verhindern veraltete Closures) ----
  const P = useRef(props);
  useEffect(() => {
    P.current = props;
  });
  const pushNotice = useCallback((n: Notice) => {
    P.current.onNotice(n);
  }, []);

  const lut = useMemo(() => buildLut(calibration, tolerance), [calibration, tolerance]);
  const lutRef = useRef(lut);
  useEffect(() => {
    lutRef.current = lut;
  }, [lut]);

  const scratchRef = useRef<{ c: HTMLCanvasElement; x: CanvasRenderingContext2D } | null>(null);
  const detRef = useRef<Partial<Record<ColorId, Detection>>>({});
  const sideRef = useRef<Partial<Record<ColorId, -1 | 1>>>({});
  const tapRef = useRef<{ fx: number; fy: number; at: number } | null>(null);
  const gridsRef = useRef<Map<ColorId, Uint8Array>>(new Map());

  const calibratedCount = COLOR_DEFS.filter((d) => calibration[d.id]).length;

  // ---------------------------------------------------------------
  // Kamera starten / stoppen
  // ---------------------------------------------------------------
  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    try {
      pushNotice({ tone: "info", text: "Kamera wird gestartet …" });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      P.current.onCameraChange(true);
      pushNotice({
        tone: "ok",
        text: "Kameras freigegeben. Tippe im Bild mittig auf eine Farbmarkierung, um sie zu kalibrieren.",
      });
    } catch (err) {
      const name = (err as DOMException | undefined)?.name ?? "";
      let text = "Kamera konnte nicht gestartet werden.";
      if (name === "NotAllowedError") text = "Kamerazugriff verweigert. Bitte in den Browser-Einstellungen erlauben.";
      else if (name === "NotFoundError") text = "Keine Kamera gefunden.";
      else if (location.protocol !== "https:" && location.hostname !== "localhost")
        text = "Kamera benötigt HTTPS (bei GitHub Pages gegeben) oder localhost.";
      pushNotice({ tone: "warn", text });
    }
  }, [pushNotice]);

  // Das Videoelement wird erst nach cameraOn gerendert. Daher den Stream
  // erst hier an das nun vorhandene Videoelement anschließen.
  useEffect(() => {
    if (!cameraOn) return;

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;

    const updateResolution = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setRes({ w: video.videoWidth, h: video.videoHeight });
      }
    };

    video.onloadedmetadata = updateResolution;
    updateResolution();

    video.play().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      pushNotice({ tone: "warn", text: `Videowiedergabe fehlgeschlagen: ${message}` });
    });

    return () => {
      video.onloadedmetadata = null;
    };
  }, [cameraOn, pushNotice]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    stopTracks();
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setFps(0);
    setLiveCount(0);
    detRef.current = {};
    P.current.onCameraChange(false);
    P.current.onLive([]);
    pushNotice({ tone: "info", text: "Kamera gestoppt." });
  }, [pushNotice, stopTracks]);

  useEffect(() => stopTracks, [stopTracks]); // Aufräumen beim Verlassen

  // ---------------------------------------------------------------
  // Analyse- + Overlay-Loop
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!cameraOn || !res) return;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    // Analyse-Canvas (niedrige Auflösung) vorbereiten
    const aw = ANALYSIS_W;
    const ah = Math.max(2, Math.round((ANALYSIS_W * res.h) / res.w) & ~1);
    if (!scratchRef.current) {
      const c = document.createElement("canvas");
      scratchRef.current = { c, x: c.getContext("2d", { willReadFrequently: true })! };
    }
    const scratch = scratchRef.current;
    scratch.c.width = aw;
    scratch.c.height = ah;

    const gw = aw / GRID_STRIDE;
    const gh = ah / GRID_STRIDE;
    const gs = gw * gh;
    for (const def of COLOR_DEFS) {
      let g = gridsRef.current.get(def.id);
      if (!g || g.length !== gs) {
        g = new Uint8Array(gs);
        gridsRef.current.set(def.id, g);
      }
    }
    const stack = new Int32Array(gs);

    // Overlay-Größe (max. 960 px breit, Rest skaliert CSS)
    const oScale = Math.min(1, 960 / res.w);
    overlay.width = Math.round(res.w * oScale);
    overlay.height = Math.round(res.h * oScale);
    const octx = overlay.getContext("2d")!;

    let raf = 0;
    let lastAnalyze = 0;
    let frames = 0;
    let fpsWindow = performance.now();
    let lastLivePush = 0;
    let lastLiveKey = "";
    let running = true;

    const analyze = (now: number) => {
      if (video.readyState < 2) return;
      const lutNow = lutRef.current;
      // schneller Check: irgendeine Farbe kalibriert?
      let any = false;
      for (const d of COLOR_DEFS) if (P.current.calibration[d.id]) any = true;
      if (!any) {
        detRef.current = {};
        return;
      }

      scratch.x.drawImage(video, 0, 0, aw, ah);
      const img = scratch.x.getImageData(0, 0, aw, ah);
      const data = img.data;

      for (const d of COLOR_DEFS) gridsRef.current.get(d.id)!.fill(0);

      for (let y = 0; y < ah; y += GRID_STRIDE) {
        const gy = (y / GRID_STRIDE) | 0;
        const rowBase = y * aw;
        for (let x = 0; x < aw; x += GRID_STRIDE) {
          const i = (rowBase + x) * 4;
          const m = lutNow[((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3)];
          if (m === 0) continue;
          const idx = gy * gw + ((x / GRID_STRIDE) | 0);
          for (let ci = 0; ci < COLOR_DEFS.length; ci++) {
            if (m & (1 << ci)) gridsRef.current.get(COLOR_DEFS[ci].id)![idx] = 1;
          }
        }
      }

      const vertical = P.current.lineVertical;
      const linePos = P.current.linePos;
      const live: ColorId[] = [];

      for (const def of COLOR_DEFS) {
        if (!P.current.calibration[def.id]) continue;
        const grid = gridsRef.current.get(def.id)!;

        let best: { area: number; minX: number; minY: number; maxX: number; maxY: number; sx: number; sy: number } | null = null;

        for (let start = 0; start < gs; start++) {
          if (grid[start] !== 1) continue;
          // Flood-Fill (4-Nachbarschaft)
          let sp = 0;
          stack[sp++] = start;
          grid[start] = 2;
          let area = 0;
          let minX = gw;
          let minY = gh;
          let maxX = 0;
          let maxY = 0;
          let sx = 0;
          let sy = 0;
          while (sp > 0) {
            const cur = stack[--sp];
            const cx = cur % gw;
            const cy = (cur / gw) | 0;
            area++;
            sx += cx;
            sy += cy;
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;
            // Nachbarn
            if (cx > 0 && grid[cur - 1] === 1) { grid[cur - 1] = 2; stack[sp++] = cur - 1; }
            if (cx < gw - 1 && grid[cur + 1] === 1) { grid[cur + 1] = 2; stack[sp++] = cur + 1; }
            if (cy > 0 && grid[cur - gw] === 1) { grid[cur - gw] = 2; stack[sp++] = cur - gw; }
            if (cy < gh - 1 && grid[cur + gw] === 1) { grid[cur + gw] = 2; stack[sp++] = cur + gw; }
          }
          if (area < MIN_BLOB || area > gs * MAX_BLOB_SHARE) continue;
          const bw = maxX - minX + 1;
          const bh = maxY - minY + 1;
          const aspect = bw / bh;
          if (aspect < 0.22 || aspect > 4.5) continue; // lange Störkanten ignorieren
          if (!best || area > best.area) best = { area, minX, minY, maxX, maxY, sx, sy };
        }

        if (best) {
          const det: Detection = {
            x: best.minX / gw,
            y: best.minY / gh,
            w: (best.maxX - best.minX + 1) / gw,
            h: (best.maxY - best.minY + 1) / gh,
            cx: (best.sx / best.area + 0.5) / gw,
            cy: (best.sy / best.area + 0.5) / gh,
            area: best.area,
            at: now,
          };
          detRef.current[def.id] = det;
          live.push(def.id);

          // --- Linien-Überquerung mit Hysterese ---
          const pos = vertical ? det.cx : det.cy;
          let side = sideRef.current[def.id];
          if (pos < linePos - SIDE_MARGIN) {
            if (side === 1 && P.current.raceFlag.current?.running) P.current.onCrossing(def.id);
            side = -1;
          } else if (pos > linePos + SIDE_MARGIN) {
            if (side === -1 && P.current.raceFlag.current?.running) P.current.onCrossing(def.id);
            side = 1;
          }
          sideRef.current[def.id] = side;
        }
      }

      // Live-Status (gedrosselt, nur bei Änderung)
      const now2 = performance.now();
      const key = live.slice().sort().join(",");
      if ((key !== lastLiveKey || now2 - lastLivePush > 800) && now2 - lastLivePush > 350) {
        lastLiveKey = key;
        lastLivePush = now2;
        setLiveCount(live.length);
        P.current.onLive(live);
      }
      frames++;
      if (now2 - fpsWindow >= 1000) {
        setFps(Math.round((frames * 1000) / (now2 - fpsWindow)));
        frames = 0;
        fpsWindow = now2;
      }
    };

    const drawOverlay = (now: number) => {
      const W = overlay.width;
      const H = overlay.height;
      octx.clearRect(0, 0, W, H);

      // --- Start-Ziel-Linie (kariert) ---
      const vertical = P.current.lineVertical;
      const lp = P.current.linePos;
      const thick = Math.max(8, Math.round(W * 0.012));
      const segs = 18;
      octx.save();
      octx.shadowColor = "rgba(56,225,255,0.55)";
      octx.shadowBlur = 10;
      if (!vertical) {
        const y = lp * H;
        const wSeg = W / segs;
        for (let i = 0; i < segs; i++) {
          octx.fillStyle = i % 2 ? "#101826" : "#e8eef5";
          octx.fillRect(i * wSeg, y - thick / 2, wSeg + 1, thick);
        }
      } else {
        const x = lp * W;
        const hSeg = H / segs;
        for (let i = 0; i < segs; i++) {
          octx.fillStyle = i % 2 ? "#101826" : "#e8eef5";
          octx.fillRect(x - thick / 2, i * hSeg, thick, hSeg + 1);
        }
      }
      octx.restore();

      // kleine Beschriftung an der Linie
      const fs = Math.max(11, Math.round(W * 0.016));
      octx.font = `700 ${fs}px ui-sans-serif, system-ui, sans-serif`;
      const label = "START / ZIEL";
      const tw = octx.measureText(label).width;
      const lx = vertical ? lp * W + thick : 6;
      const ly = vertical ? thick + fs : lp * H - thick / 2 - 5;
      octx.fillStyle = "rgba(8,12,18,0.75)";
      rr(octx, lx - 4, ly - fs - 4, tw + 10, fs + 8, 4);
      octx.fill();
      octx.fillStyle = "#7dd8f0";
      octx.fillText(label, lx + 1, ly - 3);

      // --- Erkennungs-Boxen ---
      for (const def of COLOR_DEFS) {
        const det = detRef.current[def.id];
        if (!det || now - det.at > 300) continue;
        const col = def.overlay;
        const bx = det.x * W;
        const by = det.y * H;
        const bw = det.w * W;
        const bh = det.h * H;
        octx.save();
        octx.strokeStyle = col;
        octx.lineWidth = Math.max(2, W * 0.0035);
        octx.shadowColor = col;
        octx.shadowBlur = 14;
        rr(octx, bx, by, bw, bh, Math.max(4, W * 0.006));
        octx.stroke();
        octx.restore();

        // Label über der Box
        const name = P.current.getName(def.id);
        const racing = P.current.raceFlag.current?.running;
        const laps = P.current.getLaps(def.id);
        const text = racing && laps > 0 ? `${name} · R${laps}` : name;
        const fs2 = Math.max(12, Math.round(W * 0.02));
        octx.font = `700 ${fs2}px ui-sans-serif, system-ui, sans-serif`;
        const tw2 = octx.measureText(text).width;
        const pad = 6;
        const chW = tw2 + pad * 2;
        const chH = fs2 + pad * 1.6;
        let cx0 = bx;
        let cy0 = by - chH - 4;
        if (cy0 < 0) cy0 = by + bh + 4;
        if (cx0 + chW > W) cx0 = W - chW;
        octx.fillStyle = "rgba(8,12,18,0.85)";
        rr(octx, cx0, cy0, chW, chH, 5);
        octx.fill();
        octx.strokeStyle = col;
        octx.lineWidth = 1.5;
        rr(octx, cx0, cy0, chW, chH, 5);
        octx.stroke();
        octx.fillStyle = col;
        octx.fillText(text, cx0 + pad, cy0 + chH - pad - 1);
      }

      // --- Kalibrierungs-Tipp-Animation ---
      const tap = tapRef.current;
      if (tap && now - tap.at < 400) {
        const p = (now - tap.at) / 400;
        octx.strokeStyle = `rgba(56,225,255,${1 - p})`;
        octx.lineWidth = 3;
        octx.beginPath();
        octx.arc(tap.fx * W, tap.fy * H, 10 + p * 26, 0, Math.PI * 2);
        octx.stroke();
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      if (P.current.detecting && now - lastAnalyze > 60) {
        lastAnalyze = now;
        analyze(now);
      }
      drawOverlay(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [cameraOn, res]);

  // ---------------------------------------------------------------
  // Tap-Kalibrierung: Punkt im Bild → HSV-Referenz
  // ---------------------------------------------------------------
  const handleTap = useCallback(
    (e: React.PointerEvent) => {
      if (!cameraOn || !videoRef.current || !containerRef.current || videoRef.current.readyState < 2)
        return;
      const rect = containerRef.current.getBoundingClientRect();
      const fx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const fy = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      tapRef.current = { fx, fy, at: performance.now() };

      // aktuellen Frame in den Scratch-Canvas zeichnen und mitteln
      const v = videoRef.current;
      const vw = v.videoWidth || 1280;
      const vh = v.videoHeight || 720;
      const aw = ANALYSIS_W;
      const ah = Math.max(2, Math.round((ANALYSIS_W * vh) / vw) & ~1);
      if (!scratchRef.current) {
        const c = document.createElement("canvas");
        scratchRef.current = { c, x: c.getContext("2d", { willReadFrequently: true })! };
      }
      const scratch = scratchRef.current;
      if (scratch.c.width !== aw || scratch.c.height !== ah) {
        scratch.c.width = aw;
        scratch.c.height = ah;
      }
      scratch.x.drawImage(v, 0, 0, aw, ah);
      const img = scratch.x.getImageData(0, 0, aw, ah);
      const hsv = sampleAvgHsv(img.data, aw, ah, fx * aw, fy * ah, 7);
      P.current.onCalibrate(P.current.selectedColor, hsv);
    },
    [cameraOn]
  );

  // ---------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------
  const statusText = !cameraOn
    ? "Status: Kamera aus"
    : props.detecting
      ? "Status: Farberkennung aktiv – erkannte Markierungen werden eingerahmt"
      : "Status: Kamera läuft – Farberkennung ist aus (Kalibrieren per Tippen möglich)";

  const notice = props.notice;
  const toneStyle =
    notice.tone === "ok"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
      : notice.tone === "warn"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
        : "border-cyan-400/40 bg-cyan-400/10 text-cyan-200";
  const ToneIcon = notice.tone === "ok" ? CheckCircle2 : notice.tone === "warn" ? AlertTriangle : Info;

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-[#121a24] p-4 shadow-xl shadow-black/30 sm:p-5">
      {/* Kamera-Buttons */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <button
          onClick={startCamera}
          disabled={cameraOn}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-sky-500 to-sky-700 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Video size={18} /> Kamera starten
        </button>
        <button
          onClick={stopCamera}
          disabled={!cameraOn}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-700/40 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-600/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <VideoOff size={18} /> Kamera stoppen
        </button>
      </div>

      {/* Kamerabild + Overlay */}
      <div
        ref={containerRef}
        onPointerUp={handleTap}
        className="relative w-full touch-none overflow-hidden rounded-xl border border-slate-700/70 bg-black select-none"
        style={{ aspectRatio: res ? `${res.w} / ${res.h}` : "16 / 9" }}
      >
        {cameraOn ? (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="absolute inset-0 h-full w-full object-cover"
            />
            <canvas ref={overlayRef} className="absolute inset-0 h-full w-full" />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Video size={40} strokeWidth={1.5} />
            <p className="text-sm">Kamera ist aus</p>
          </div>
        )}
      </div>

      {/* Status + Hinweis */}
      <p className="mt-3 text-[13px] text-slate-400">{statusText}</p>
      <div className={`mt-2 flex items-start gap-2 rounded-xl border-l-4 px-3 py-2.5 text-[13px] leading-snug ${toneStyle}`}>
        <ToneIcon size={16} className="mt-0.5 shrink-0" />
        <span>{notice.text}</span>
      </div>

      {/* Statistiken */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          { v: String(fps), l: "Analyse-FPS" },
          { v: `${liveCount} / ${calibratedCount || 6}`, l: "Farben erkannt" },
          { v: res ? `${res.w}×${res.h}` : "–", l: "Kameraauflösung" },
        ].map((s) => (
          <div
            key={s.l}
            className="rounded-xl border border-slate-700/60 bg-[#0e1520] px-3 py-3 text-center"
          >
            <div className="tabular text-lg font-bold text-slate-100">{s.v}</div>
            <div className="mt-0.5 text-[11px] tracking-wide text-slate-400">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
