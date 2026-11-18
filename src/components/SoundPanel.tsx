import { Bell, Star, Trophy, Volume2, VolumeX } from "lucide-react";
import { sound, type SoundKind } from "../lib/sounds";

interface Props {
  enabled: boolean;
  onToggle: (on: boolean) => void;
  volume: number; // 0..100
  onVolume: (v: number) => void;
}

const TESTS: { kind: SoundKind; label: string; hint: string; Icon: typeof Bell }[] = [
  { kind: "lap", label: "Runden-Signal", hint: "kurzes „Dit!“", Icon: Bell },
  { kind: "best", label: "Bestzeit-Melodie", hint: "bei neuer Bestzeit", Icon: Star },
  { kind: "finish", label: "Siegesmelodie", hint: "am Rennende", Icon: Trophy },
];

export default function SoundPanel(p: Props) {
  const test = (kind: SoundKind) => {
    sound.unlock();
    sound.play(kind);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-400/30 bg-[#121a24] p-4 shadow-xl shadow-black/30 sm:p-5">
      <span className="absolute top-0 right-0 rounded-bl-xl bg-cyan-400/15 px-2.5 py-1 text-[10px] font-bold tracking-widest text-cyan-300 uppercase">
        Neu in 0.4
      </span>
      <h2 className="text-base font-bold text-slate-100">
        <span className="mr-2 text-cyan-300">4 ·</span>Sound
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-slate-400">
        Alle Signale werden live per Web Audio API erzeugt – es sind keine Audiodateien nötig.
      </p>

      {/* Ein/Aus-Schalter */}
      <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700/60 bg-[#0e1520] px-3.5 py-3">
        <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-200">
          {p.enabled ? (
            <Volume2 size={18} className="text-cyan-300" />
          ) : (
            <VolumeX size={18} className="text-slate-500" />
          )}
          Sound {p.enabled ? "an" : "aus"}
        </span>
        <button
          role="switch"
          aria-checked={p.enabled}
          aria-label="Sound ein-/ausschalten"
          onClick={() => p.onToggle(!p.enabled)}
          className={`relative h-7 w-13 rounded-full transition-colors ${
            p.enabled ? "bg-emerald-500" : "bg-slate-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              p.enabled ? "translate-x-6" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Lautstärke */}
      <label className="mt-4 block text-[13px] font-semibold text-slate-300">
        Lautstärke <span className="tabular text-cyan-300">{p.volume} %</span>
      </label>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={p.volume}
        disabled={!p.enabled}
        onChange={(e) => p.onVolume(Number(e.target.value))}
        className="mt-1.5 w-full disabled:opacity-40"
      />

      {/* Test-Knöpfe */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {TESTS.map(({ kind, label, hint, Icon }) => (
          <button
            key={kind}
            onClick={() => test(kind)}
            disabled={!p.enabled}
            className="group flex flex-col items-center gap-1 rounded-xl border border-slate-600/70 bg-[#0e1520] px-2 py-3 text-center transition hover:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon size={19} className="text-cyan-300 transition group-hover:scale-110" />
            <span className="text-[12px] leading-tight font-bold text-slate-200">{label}</span>
            <span className="text-[10px] leading-tight text-slate-500">{hint}</span>
          </button>
        ))}
      </div>
      {!p.enabled && (
        <p className="mt-2 text-[12px] text-slate-500">
          Ton ist ausgeschaltet – zum Testen oben einschalten.
        </p>
      )}
    </section>
  );
}
