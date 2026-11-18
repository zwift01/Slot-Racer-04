import { Timer } from "lucide-react";
import type { CarStats, ColorId } from "../types";
import { colorDef } from "../types";
import { formatLap } from "../lib/format";

interface Props {
  order: ColorId[];
  stats: Record<ColorId, CarStats>;
  names: Partial<Record<ColorId, string>>;
}

export default function LapHistory({ order, stats, names }: Props) {
  const maxLaps = order.reduce(
    (max, id) => Math.max(max, stats[id].lapTimes.length),
    0
  );

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-[#121a24] p-4 shadow-xl shadow-black/30 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
          <Timer size={18} className="text-cyan-300" />
          Rundenzeiten im direkten Vergleich
        </h2>
        <span className="shrink-0 text-[11px] tracking-widest text-slate-500 uppercase">
          {maxLaps} {maxLaps === 1 ? "Runde" : "Runden"}
        </span>
      </div>

      {order.length === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-700/60 bg-[#0e1520] px-3.5 py-3 text-[13px] leading-snug text-slate-500">
          Sobald du Fahrzeuge kalibriert hast, erscheinen ihre einzelnen Rundenzeiten hier
          nebeneinander.
        </p>
      ) : maxLaps === 0 ? (
        <p className="mt-3 rounded-xl border border-slate-700/60 bg-[#0e1520] px-3.5 py-3 text-[13px] leading-snug text-slate-500">
          Noch keine Runden gefahren. Nach dem Rennstart werden die Zeiten hier Runde für Runde
          gesammelt.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-700/70">
                <th className="sticky left-0 z-10 bg-[#121a24] px-3 py-2 text-left text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                  Runde
                </th>
                {order.map((id) => {
                  const def = colorDef(id);
                  return (
                    <th key={id} className="min-w-28 px-3 py-2 text-right">
                      <span className="inline-flex items-center justify-end gap-2 whitespace-nowrap text-xs font-bold text-slate-200">
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-black/40"
                          style={{ backgroundColor: def.css }}
                        />
                        {names[id]?.trim() || def.label}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxLaps }, (_, index) => (
                <tr key={index} className="border-b border-slate-800/70 last:border-0">
                  <th className="sticky left-0 z-10 bg-[#121a24] px-3 py-2.5 text-left text-xs font-semibold text-slate-400">
                    {index + 1}
                  </th>
                  {order.map((id) => {
                    const s = stats[id];
                    const lap = s.lapTimes[index];
                    const isBest = lap != null && lap === s.bestLap;
                    return (
                      <td
                        key={id}
                        className={`tabular px-3 py-2.5 text-right font-semibold ${
                          isBest ? "text-amber-300" : "text-slate-300"
                        }`}
                      >
                        {lap == null ? "–" : formatLap(lap)}
                        {isBest && <span className="ml-1 text-[9px]">★</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2.5 text-[11px] leading-snug text-slate-600">
        Alle Fahrer stehen nebeneinander. Die persönliche Bestzeit ist mit ★ markiert. Auf kleinen
        Bildschirmen lässt sich die Tabelle seitlich verschieben.
      </p>
    </section>
  );
}
