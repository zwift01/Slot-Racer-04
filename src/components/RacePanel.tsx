import { useEffect, useRef } from "react";
import { Flag, Pause, Play, RotateCcw, Trophy } from "lucide-react";
import type { ColorId, RaceState } from "../types";
import { colorDef } from "../types";
import { formatLap, formatRace } from "../lib/format";

function Clock({ getClock }: { getClock: () => number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (ref.current) ref.current.textContent = formatRace(getClock());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [getClock]);
  return <span ref={ref} />;
}

interface WinnerInfo {
  id: ColorId;
  laps: number;
  bestLap: number | null;
  avgLap: number | null;
}

interface Props {
  state: RaceState;
  getClock: () => number;
  onStart: () => void;
  onTogglePause: () => void;
  onFinish: () => void;
  onReset: () => void;
  minLapMs: number;
  onMinLap: (v: number) => void;
  lapTarget: number;
  onLapTarget: (v: number) => void;
  winner: WinnerInfo | null;
  getName: (id: ColorId) => string;
}

const STATE_BADGE: Record<RaceState, { text: string; dot: string }> = {
  idle: { text: "Bereit", dot: "bg-slate-400" },
  running: { text: "Rennen läuft", dot: "bg-emerald-400" },
  paused: { text: "Pausiert", dot: "bg-amber-400" },
  finished: { text: "Beendet", dot: "bg-sky-400" },
};

export default function RacePanel(p: Props) {
  const badge = STATE_BADGE[p.state];

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-[#121a24] p-4 shadow-xl shadow-black/30 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-100">
          <span className="mr-2 text-cyan-300">3 ·</span>Rennen
        </h2>
        <span className="flex items-center gap-1.5 rounded-full border border-slate-600/70 bg-[#0e1520] px-2.5 py-1 text-[11px] font-semibold text-slate-300">
          <span className={`h-2 w-2 rounded-full ${badge.dot} ${p.state === "running" ? "animate-pulse" : ""}`} />
          {badge.text}
        </span>
      </div>

      {/* Rennuhr */}
      <div className="mt-3 rounded-xl border border-slate-700/60 bg-[#0a1018] px-4 py-4 text-center">
        <div className="tabular text-4xl font-black tracking-wide text-slate-50">
          <Clock getClock={p.getClock} />
        </div>
        <div className="mt-1 text-[11px] tracking-widest text-slate-500 uppercase">Rennzeit</div>
      </div>

      {/* Sieger-Anzeige */}
      {p.state === "finished" && p.winner && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2.5">
          <Trophy size={20} className="shrink-0 text-amber-300" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-amber-200">
              Sieger: {p.getName(p.winner.id)}
            </div>
            <div className="tabular text-[12px] text-amber-200/80">
              {p.winner.laps} Runden · Beste {formatLap(p.winner.bestLap)} · Ø{" "}
              {formatLap(p.winner.avgLap)}
            </div>
          </div>
          <span
            className="ml-auto h-4 w-4 shrink-0 rounded-full border border-black/40"
            style={{ backgroundColor: colorDef(p.winner.id).css }}
          />
        </div>
      )}

      {/* Steuerung */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {p.state === "running" ? (
          <button
            onClick={p.onTogglePause}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25"
          >
            <Pause size={17} /> Pause
          </button>
        ) : p.state === "paused" ? (
          <button
            onClick={p.onTogglePause}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 px-3 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Play size={17} /> Weiter
          </button>
        ) : (
          <button
            onClick={p.onStart}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 px-3 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            <Play size={17} /> Start
          </button>
        )}
        <button
          onClick={p.onFinish}
          disabled={p.state !== "running" && p.state !== "paused"}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-500/15 px-3 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Flag size={17} /> Beenden
        </button>
        <button
          onClick={p.onReset}
          disabled={p.state === "idle"}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-700/40 px-3 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-600/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>

      {/* Mindestrundenzeit */}
      <label className="mt-4 block text-[13px] font-semibold text-slate-300">
        Mindestrundenzeit{" "}
        <span className="tabular text-cyan-300">
          {(p.minLapMs / 1000).toFixed(1).replace(".", ",")} s
        </span>
      </label>
      <input
        type="range"
        min={1000}
        max={15000}
        step={500}
        value={p.minLapMs}
        onChange={(e) => p.onMinLap(Number(e.target.value))}
        className="mt-1.5 w-full"
      />
      <p className="mt-1.5 text-[12px] leading-snug text-slate-500">
        Schnellere Überquerungen gelten als Doppelzählung und werden verworfen.
      </p>

      {/* Rundenziel */}
      <div className="mt-4">
        <div className="text-[13px] font-semibold text-slate-300">Rundenziel (optional)</div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {[0, 10, 20, 30, 50].map((v) => (
            <button
              key={v}
              onClick={() => p.onLapTarget(v)}
              className={`rounded-lg border py-2 text-[12px] font-bold transition ${
                p.lapTarget === v
                  ? "border-cyan-300 bg-[#16222e] text-cyan-200"
                  : "border-slate-600/70 bg-[#0e1520] text-slate-400 hover:border-slate-500"
              }`}
            >
              {v === 0 ? "Aus" : v}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-slate-500">
          Bei einem Ziel endet das Rennen automatisch, sobald ein Fahrzeug diese Rundenzahl
          erreicht – inklusive Siegesmelodie.
        </p>
      </div>
    </section>
  );
}
