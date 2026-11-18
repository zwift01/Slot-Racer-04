import { ListOrdered, Trophy } from "lucide-react";
import type { CarStats, ColorId, RaceState } from "../types";
import { colorDef } from "../types";
import { formatLap } from "../lib/format";

interface Props {
  order: ColorId[];
  stats: Record<ColorId, CarStats>;
  names: Partial<Record<ColorId, string>>;
  onName: (id: ColorId, v: string) => void;
  live: ReadonlySet<ColorId>;
  raceState: RaceState;
  winnerId: ColorId | null;
}

const COLS = "grid grid-cols-[1.75rem_minmax(8.5rem,1fr)_4rem_5.75rem_5.75rem_5.75rem] items-center gap-x-2";

export default function Leaderboard(p: Props) {
  const rows = [...p.order]
    .map((id) => p.stats[id])
    .sort((a, b) => {
      if (b.laps !== a.laps) return b.laps - a.laps;
      const ab = a.laps ? a.total / a.laps : Infinity;
      const bb = b.laps ? b.total / b.laps : Infinity;
      if (ab !== bb) return ab - bb;
      return (a.bestLap ?? Infinity) - (b.bestLap ?? Infinity);
    });

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-[#121a24] p-4 shadow-xl shadow-black/30 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
          <ListOrdered size={18} className="text-cyan-300" /> Live-Rangliste
        </h2>
        <span className="text-[11px] tracking-widest text-slate-500 uppercase">
          {p.order.length} {p.order.length === 1 ? "Fahrzeug" : "Fahrzeuge"}
        </span>
      </div>

      {p.order.length === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-700/60 bg-[#0e1520] px-3.5 py-3 text-[13px] leading-snug text-slate-500">
          Noch keine Fahrzeuge angelegt. Kalibriere oben eine oder mehrere Farben – jedes
          kalibrierte Fahrzeug erscheint hier automatisch.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <div className="min-w-[34rem]">
            {/* Kopf */}
            <div className={`${COLS} border-b border-slate-700/70 px-2 pb-2 text-[10px] font-bold tracking-widest text-slate-500 uppercase`}>
              <span>#</span>
              <span>Fahrer / Fahrzeug</span>
              <span className="text-right">Runden</span>
              <span className="text-right">Letzte</span>
              <span className="text-right">Beste</span>
              <span className="text-right">Ø</span>
            </div>

            {rows.map((s, i) => {
              const def = colorDef(s.id);
              const isWinner = p.raceState === "finished" && p.winnerId === s.id;
              const isLive = p.live.has(s.id);
              const avg = s.laps > 0 ? s.total / s.laps : null;
              return (
                <div
                  key={s.id}
                  className={`${COLS} border-b border-slate-800/70 px-2 py-2.5 last:border-0 ${
                    isWinner ? "bg-amber-400/5" : ""
                  }`}
                >
                  <span className="flex justify-center">
                    {isWinner ? (
                      <Trophy size={16} className="text-amber-300" />
                    ) : (
                      <span className="tabular text-sm font-bold text-slate-500">{i + 1}</span>
                    )}
                  </span>

                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full transition ${
                        isLive ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" : "bg-slate-700"
                      }`}
                      title={isLive ? "wird gerade erkannt" : "aktuell nicht erkannt"}
                    />
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/40"
                      style={{ backgroundColor: def.css }}
                    />
                    <input
                      value={p.names[s.id] ?? ""}
                      onChange={(e) => p.onName(s.id, e.target.value.slice(0, 18))}
                      placeholder={def.label}
                      className="w-full min-w-0 border-b border-transparent bg-transparent text-sm font-semibold text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400"
                    />
                  </span>

                  <span key={`l${s.laps}`} className="lapflash tabular rounded-md py-0.5 text-right text-sm font-black text-slate-50">
                    {s.laps}
                  </span>
                  <span className="tabular text-right text-sm text-slate-300">{formatLap(s.lastLap)}</span>
                  <span
                    key={`b${s.bestLap ?? "x"}`}
                    className="bestflash tabular rounded-md py-0.5 text-right text-sm font-bold text-amber-300"
                  >
                    {formatLap(s.bestLap)}
                  </span>
                  <span className="tabular text-right text-sm text-slate-300">{formatLap(avg)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="mt-2.5 text-[11px] leading-snug text-slate-600">
        Tipp: Namen lassen sich direkt in der Tabelle eintippen und bleiben gespeichert.
      </p>
    </section>
  );
}
