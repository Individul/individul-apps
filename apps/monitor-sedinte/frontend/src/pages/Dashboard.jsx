import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiFetch } from '../api/client';
import StatsCard from '../components/StatsCard';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [urmatoarele, setUrmatoarele] = useState([]);
  const [activitate, setActivitate] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/dashboard/stats'),
      apiFetch('/dashboard/timeline'),
      apiFetch('/dashboard/urmatoarele?limit=10'),
      apiFetch('/dashboard/activitate')
    ]).then(([s, t, u, a]) => {
      setStats(s);
      setTimeline(t);
      setUrmatoarele(u);
      setActivitate(a);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Persoane monitorizate"
          value={stats?.total_persoane || 0}
          color="blue"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
        />
        <StatsCard
          label="Sedinte viitoare"
          value={stats?.sedinte_viitoare || 0}
          color="green"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
        />
        <StatsCard
          label="Sedinte azi / maine"
          value={`${stats?.sedinte_azi || 0} / ${stats?.sedinte_maine || 0}`}
          color="amber"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatsCard
          label="Noi in 24h"
          value={stats?.sedinte_noi_24h || 0}
          color="purple"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
      </div>

      {/* Timeline chart */}
      {timeline.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Sedinte noi detectate (ultimele 30 zile)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="zi" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#dbeafe" name="Sedinte" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming hearings */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Urmatoarele sedinte</h2>
          {urmatoarele.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Nu sunt sedinte viitoare</p>
          ) : (
            <div className="space-y-2">
              {urmatoarele.map(s => (
                <div
                  key={s.id}
                  className={`p-3 rounded-lg text-sm ${
                    s.data_sedinta_iso === today
                      ? 'bg-amber-50 border border-amber-200'
                      : s.data_sedinta_iso === tomorrow
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{s.data_sedinta} {s.ora}</span>
                    <span className="text-xs text-slate-500">{s.instanta_nume}</span>
                  </div>
                  <div className="text-slate-600 mt-0.5">{s.persoana_nume} — {s.numar_dosar}</div>
                  {s.obiect_cauza && <div className="text-xs text-slate-400 mt-0.5">{s.obiect_cauza}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity log */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Activitate recenta</h2>
          {activitate.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Nicio activitate inregistrata</p>
          ) : (
            <div className="space-y-2">
              {activitate.map(a => (
                <div key={a.id} className="flex items-start gap-3 text-sm py-2 border-b border-slate-50 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    a.eroare ? 'bg-red-400' : a.sedinte_noi > 0 ? 'bg-green-400' : 'bg-slate-300'
                  }`} />
                  <div className="min-w-0">
                    <div className="text-slate-700">
                      {a.persoana_nume || 'Sistem'} — {a.instanta_cod || 'general'}
                      {a.sedinte_noi > 0 && <span className="text-green-600 ml-1">+{a.sedinte_noi} noi</span>}
                      {a.eroare && <span className="text-red-500 ml-1">eroare</span>}
                    </div>
                    <div className="text-xs text-slate-400">{a.timestamp} | {a.sedinte_gasite} gasite | {a.durata_ms}ms</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Last verification */}
      {stats?.ultima_verificare && (
        <p className="text-xs text-slate-400 text-center">
          Ultima verificare: {stats.ultima_verificare}
        </p>
      )}
    </div>
  );
}
