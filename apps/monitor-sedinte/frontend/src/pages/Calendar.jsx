import { useState, useEffect, useMemo } from 'react';
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

  // Upcoming sessions from today onward in this month
  const upcomingSedinte = useMemo(() => {
    const result = [];
    for (const [date, sedinte] of Object.entries(data)) {
      if (date >= today) {
        for (const s of sedinte) {
          result.push({ ...s, _date: date });
        }
      }
    }
    result.sort((a, b) => a._date.localeCompare(b._date) || (a.ora || '').localeCompare(b.ora || ''));
    return result;
  }, [data, today]);

  const selectedSedinte = selectedDate ? (data[selectedDate] || []) : [];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-4">Calendar</h1>

      <div className="flex gap-4 items-start">
        {/* Left: Calendar grid */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 w-80 flex-shrink-0">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-sm font-semibold text-slate-900">{LUNI[month - 1]} {year}</h2>
            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-px mb-1">
            {ZILE_SAPTAMANA.map(z => (
              <div key={z} className="text-center text-[11px] font-medium text-slate-400 py-1">{z}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px">
              {cells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="h-9" />;

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
                    className={`h-9 rounded p-0.5 text-xs transition-colors flex flex-col items-center justify-center ${
                      isSelected ? 'bg-blue-100 ring-1 ring-blue-400' :
                      isToday ? 'bg-amber-50 ring-1 ring-amber-300' :
                      sedinte.length > 0 ? 'bg-slate-50 hover:bg-slate-100' :
                      'hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-xs leading-none ${isToday ? 'font-bold text-amber-700' : 'text-slate-700'}`}>{day}</span>
                    {sedinte.length > 0 && (
                      <div className="flex items-center gap-px mt-0.5">
                        {hasPenal && <span className="w-1 h-1 rounded-full bg-red-400" />}
                        {hasCivil && <span className="w-1 h-1 rounded-full bg-blue-400" />}
                        {!hasPenal && !hasCivil && <span className="w-1 h-1 rounded-full bg-green-400" />}
                        {sedinte.length > 1 && (
                          <span className="text-[9px] text-slate-400 leading-none">{sedinte.length}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-3 mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Penal</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Civil</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Alt tip</span>
          </div>
        </div>

        {/* Right: Details panel */}
        <div className="flex-1 min-w-0">
          {/* Selected date details */}
          {selectedDate && selectedSedinte.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">
                Sedinte pe {selectedDate.split('-').reverse().join('.')} ({selectedSedinte.length})
              </h3>
              <div className="space-y-2">
                {selectedSedinte.map(s => (
                  <div key={s.id} className="p-2.5 bg-slate-50 rounded-lg text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">{s.ora || '?'} — {s.persoana_nume}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        s.tip_dosar === 'Penal' ? 'bg-red-100 text-red-700' :
                        s.tip_dosar === 'Civil' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{s.tip_dosar || '-'}</span>
                    </div>
                    <div className="text-slate-500 text-xs mt-1">{s.instanta_nume} — {s.numar_dosar}</div>
                    {s.judecator && <div className="text-xs text-slate-400 mt-0.5">Judecator: {s.judecator}</div>}
                    {s.obiect_cauza && <div className="text-xs text-slate-400">{s.obiect_cauza}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedDate && selectedSedinte.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 text-center">
              <p className="text-sm text-slate-400">Nicio sedinta pe {selectedDate.split('-').reverse().join('.')}</p>
            </div>
          )}

          {/* Upcoming sessions list */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">
              Sedinte viitoare ({upcomingSedinte.length})
            </h3>
            {upcomingSedinte.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nicio sedinta viitoare in aceasta luna</p>
            ) : (
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {upcomingSedinte.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedDate(s._date)}
                    className={`p-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                      s._date === today ? 'bg-amber-50 hover:bg-amber-100' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500 w-20">{s._date.split('-').reverse().join('.')} {s.ora || ''}</span>
                        <span className="font-medium text-slate-900">{s.persoana_nume}</span>
                      </div>
                      <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${
                        s.tip_dosar === 'Penal' ? 'bg-red-100 text-red-700' :
                        s.tip_dosar === 'Civil' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{s.tip_dosar || '-'}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 ml-[88px]">{s.instanta_nume}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
