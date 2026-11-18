import { MoveHorizontal, MoveVertical } from "lucide-react";

interface Props {
  linePos: number; // 0..1
  onLinePos: (v: number) => void;
  lineVertical: boolean;
  onLineVertical: (v: boolean) => void;
}

export default function LinePanel(p: Props) {
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-[#121a24] p-4 shadow-xl shadow-black/30 sm:p-5">
      <h2 className="text-base font-bold text-slate-100">
        <span className="mr-2 text-cyan-300">2 ·</span>Start-Ziel-Linie
      </h2>
      <p className="mt-1 text-[13px] leading-snug text-slate-400">
        Lege die karierte Linie im Kamerabild genau über die Start-/Ziellinie deiner Bahn.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          onClick={() => p.onLineVertical(false)}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
            !p.lineVertical
              ? "border-cyan-300 bg-[#16222e] text-slate-50 ring-2 ring-cyan-300/60"
              : "border-slate-600/70 bg-[#0e1520] text-slate-300 hover:border-slate-500"
          }`}
        >
          <MoveHorizontal size={16} /> Waagerecht
        </button>
        <button
          onClick={() => p.onLineVertical(true)}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
            p.lineVertical
              ? "border-cyan-300 bg-[#16222e] text-slate-50 ring-2 ring-cyan-300/60"
              : "border-slate-600/70 bg-[#0e1520] text-slate-300 hover:border-slate-500"
          }`}
        >
          <MoveVertical size={16} /> Senkrecht
        </button>
      </div>

      <label className="mt-4 block text-[13px] font-semibold text-slate-300">
        Position <span className="tabular text-cyan-300">{Math.round(p.linePos * 100)} %</span>
      </label>
      <input
        type="range"
        min={5}
        max={95}
        step={1}
        value={Math.round(p.linePos * 100)}
        onChange={(e) => p.onLinePos(Number(e.target.value) / 100)}
        className="mt-1.5 w-full"
      />
      <p className="mt-1.5 text-[12px] leading-snug text-slate-500">
        Eine Runde zählt, sobald eine erkannte Markierung die Linie vollständig überquert –
        egal aus welcher Richtung.
      </p>
    </section>
  );
}
