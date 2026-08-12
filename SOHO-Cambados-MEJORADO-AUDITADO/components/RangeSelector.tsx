'use client';
import { DateRange, RANGE_OPTIONS, RangePreset, presetRange } from '@/lib/reporting';

export function RangeSelector({ value, onChange, compact = false }: { value: DateRange; onChange: (value: DateRange) => void; compact?: boolean }) {
  function changePreset(preset: RangePreset) {
    onChange(preset === 'custom' ? { ...value, preset } : presetRange(preset));
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <select value={value.preset} onChange={(e) => changePreset(e.target.value as RangePreset)} className="rounded-2xl border border-black/10 bg-white px-4 py-2.5 font-black text-neutral-950 shadow-sm outline-none">
        {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {value.preset === 'custom' && <>
        <input type="date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} className="rounded-2xl border border-black/10 bg-white px-3 py-2.5 font-bold" />
        <span className="font-bold text-slate-500">a</span>
        <input type="date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} className="rounded-2xl border border-black/10 bg-white px-3 py-2.5 font-bold" />
      </>}
    </div>
  );
}
