import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

const ZILE_SAPTAMANA = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sa', 'Du'];
const LUNI = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

export default function Calendar() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/sedinte/calendar?luna=${month}&an=${year}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month, year]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = lastDay.getDate();

  const cells = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const today = now.toISOString().split('T')[0];

  function dateKey(day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Calendar</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h2 className="text-lg font-semibold text-slate-900">{LUNI[month - 1]} {year}</h2>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {ZILE_SAPTAMANA.map(z => (
            <div key={z} className="text-center text-xs font-medium text-slate-500 py-2">{z}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="aspect-square" />;

              const dk = dateKey(day);
              const sedinte = data[dk] || [];
              const isToday = dk === today;
              const isSelected = selectedDate === dk;
              const hasPenal = sedinte.some(s => s.tip_dosar === 'Penal');
              const hasCivil = sedinte.some(s => s.tip_dosar === 'Civil');

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dk)}
                  className={`aspect-square rounded-lg p-1 text-sm transition-colors relative ${
                    isSelected ? 'bg-blue-100 ring-2 ring-blue-400' :
                    isToday ? 'bg-amber-50 ring-1 ring-amber-300' :
                    sedinte.length > 0 ? 'bg-slate-50 hover:bg-slate-100' :
                    'hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-xs ${isToday ? 'font-bold text-amber-700' : 'text-slate-700'}`}>{day}</span>
                  {sedinte.length > 0 && (
                    <div className="flex justify-center gap-0.5 mt-0.5">
                      {hasPenal && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                      {hasCivil && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      {!hasPenal && !hasCivil && <span className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                      {sedinte.length > 1 && (
                        <span className="text-[10px] text-slate-500 ml-0.5">{sedinte.length}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Penal</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Civil</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Alt tip</span>
        </div>
      </div>

      {/* Selected date details */}
      {selectedDate && data[selectedDate] && data[selectedDate].length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-medium text-slate-700 mb-3">
            Sedinte pe {selectedDate.split('-').reverse().join('.')} ({data[selectedDate].length})
          </h3>
          <div className="space-y-2">
            {data[selectedDate].map(s => (
              <div key={s.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.ora || '?'} — {s.persoana_nume}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    s.tip_dosar === 'Penal' ? 'bg-red-100 text-red-700' :
                    s.tip_dosar === 'Civil' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{s.tip_dosar || '-'}</span>
                </div>
                <div className="text-slate-600 mt-1">{s.instanta_nume} — {s.numar_dosar}</div>
                {s.judecator && <div className="text-xs text-slate-400 mt-0.5">Judecator: {s.judecator}</div>}
                {s.obiect_cauza && <div className="text-xs text-slate-400">{s.obiect_cauza}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedDate && (!data[selectedDate] || data[selectedDate].length === 0) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 text-center">
          <p className="text-sm text-slate-400">Nicio sedinta pe {selectedDate.split('-').reverse().join('.')}</p>
        </div>
      )}
    </div>
  );
}
