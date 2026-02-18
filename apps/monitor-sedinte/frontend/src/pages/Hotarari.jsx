import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export default function Hotarari() {
  const [hotarari, setHotarari] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(1);
  const [persoane, setPersoane] = useState([]);
  const [filters, setFilters] = useState({ persoana: '', instanta: '', tip: '' });

  useEffect(() => {
    apiFetch('/persoane').then(d => setPersoane(d.data || d)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ pagina, limit: 20 });
    if (filters.persoana) params.set('persoana', filters.persoana);
    if (filters.instanta) params.set('instanta', filters.instanta);
    if (filters.tip) params.set('tip', filters.tip);

    apiFetch(`/hotarari?${params}`)
      .then(d => { setHotarari(d.data); setTotal(d.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [pagina, filters]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">Hotarari & Incheieri</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3">
        <select
          value={filters.persoana}
          onChange={e => { setFilters(f => ({ ...f, persoana: e.target.value })); setPagina(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="">Toate persoanele</option>
          {persoane.map(p => <option key={p.id} value={p.id}>{p.nume}</option>)}
        </select>
        <select
          value={filters.tip}
          onChange={e => { setFilters(f => ({ ...f, tip: e.target.value })); setPagina(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="">Toate tipurile</option>
          <option value="Hotărâre">Hotarare</option>
          <option value="Încheiere">Incheiere</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : hotarari.length === 0 ? (
          <p className="text-center py-12 text-slate-400">Nicio hotarare gasita</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Tip</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Nr. Dosar</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Persoana</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Instanta</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Judecator</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Solutie</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">PDF</th>
                </tr>
              </thead>
              <tbody>
                {hotarari.map(h => (
                  <tr key={h.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        h.tip_act === 'Hotărâre' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
                      }`}>
                        {h.tip_act}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{h.numar_dosar}</td>
                    <td className="px-4 py-3 text-slate-600">{h.persoana_nume}</td>
                    <td className="px-4 py-3 text-slate-600">{h.instanta_nume}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{h.data_pronuntare || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{h.judecator || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={h.solutie}>{h.solutie || '-'}</td>
                    <td className="px-4 py-3">
                      {h.pdf_link ? (
                        <a href={h.pdf_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                          Descarca
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">{total} rezultate</span>
            <div className="flex gap-1">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40">
                Inapoi
              </button>
              <span className="px-3 py-1.5 text-xs text-slate-600">{pagina} / {totalPages}</span>
              <button onClick={() => setPagina(p => Math.min(totalPages, p + 1))} disabled={pagina === totalPages}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40">
                Inainte
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
