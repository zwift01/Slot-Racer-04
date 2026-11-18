import { Check, Circle, Eraser, ScanLine } from "lucide-react";
import type { Calibration, ColorId, HsvRef } from "../types";
import { COLOR_DEFS } from "../types";

interface Props {
  selected: ColorId;
  onSelect: (id: ColorId) => void;
  calibration: Calibration;
  lastCalib: { id: ColorId; hsv: HsvRef } | null;
  detecting: boolean;
  onToggleDetect: () => void;
  onClearSelected: () => void;
  tolerance: number;
  onTolerance: (v: number) => void;
}

export default function CalibrationPanel(p: Props) {
  const calibratedCount = COLOR_DEFS.filter((d) => p.calibration[d.id]).length;

  return (
    <section className="rounded-2xl border border-slate-700/60 bg-[#121a24] p-4 shadow-xl shadow-black/30 sm:p-5">
      <h2 className="text-base font-bold text-slate-100">
        <span className="mr-2 text-cyan-300">1 ·</span>Farbe auswählen
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-slate-400">
        Wähle eine Fahrzeugfarbe und tippe anschließend im Kamerabild möglichst mittig auf den
        passenden 20 × 20-mm-Aufkleber.
      </p>

      {/* Farbauswahl */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {COLOR_DEFS.map((d) => {
          const active = p.selected === d.id;
          const calib = !!p.calibration[d.id];
          return (
            <button
              key={d.id}
              onClick={() => p.onSelect(d.id)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "border-cyan-300 bg-[#16222e] text-slate-50 ring-2 ring-cyan-300/60"
                  : "border-slate-600/70 bg-[#0e1520] text-slate-300 hover:border-slate-500"
              }`}
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full border border-black/40"
                style={{ backgroundColor: d.css }}
              />
              <span className="truncate">{d.label}</span>
              <span className="ml-auto">
                {calib ? (
                  <Check size={15} className="text-emerald-400" />
                ) : (
                  <Circle size={10} className="text-slate-600" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Aktionen */}
      <button
        onClick={p.onToggleDetect}
        disabled={calibratedCount === 0}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          p.detecting
            ? "border border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
            : "bg-gradient-to-b from-sky-500 to-sky-700 text-white hover:brightness-110"
        }`}
      >
        <ScanLine size={18} />
        {p.detecting ? "Farberkennung stoppen" : "Farberkennung starten"}
      </button>
      <button
        onClick={p.onClearSelected}
        disabled={!p.calibration[p.selected]}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-700/40 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-600/50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Eraser size={16} /> Kalibrierung löschen ({COLOR_DEFS.find((d) => d.id === p.selected)!.label})
      </button>

      <p className="mt-3 text-[12px] leading-snug text-slate-500">
        {p.lastCalib
          ? `Kalibriert: ${COLOR_DEFS.find((d) => d.id === p.lastCalib!.id)!.label} · H ${Math.round(p.lastCalib.hsv.h)}° · S ${p.lastCalib.hsv.s} · V ${p.lastCalib.hsv.v}. Wähle die nächste Farbe.`
          : "Noch nichts kalibriert. Farbe wählen, dann im Kamerabild auf die Markierung tippen."}
      </p>

      {/* Toleranz */}
      <label className="mt-4 block text-[13px] font-semibold text-slate-300">
        Farbtoleranz <span className="tabular text-cyan-300">{p.tolerance}</span>
      </label>
      <input
        type="range"
        min={2}
        max={40}
        step={1}
        value={p.tolerance}
        onChange={(e) => p.onTolerance(Number(e.target.value))}
        className="mt-1.5 w-full"
      />
      <p className="mt-1.5 text-[12px] leading-snug text-slate-500">
        Bei zu vielen falschen Treffern verringern; wenn der Aufkleber nicht erkannt wird,
        vorsichtig erhöhen. Für <b>Schwarz</b> meist ein kleiner Wert (3–6) nötig.
      </p>
    </section>
  );
}
