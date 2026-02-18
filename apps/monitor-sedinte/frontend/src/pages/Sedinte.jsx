import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/client';

const INSTANTE = {
  jc: 'Judecatoria Chisinau', jsr: 'Judecatoria Soroca', jbl: 'Judecatoria Balti',
  jch: 'Judecatoria Cahul', jcm: 'Judecatoria Comrat', jed: 'Judecatoria Edinet',
  jhn: 'Judecatoria Hincesti', jun: 'Judecatoria Ungheni', jor: 'Judecatoria Orhei',
  jcs: 'Judecatoria Causeni', jst: 'Judecatoria Straseni', jcl: 'Judecatoria Calarasi',
  jan: 'Judecatoria Anenii Noi', jri: 'Judecatoria Rezina', cac: 'Curtea de Apel Chisinau',
  cab: 'Curtea de Apel Balti', cach: 'Curtea de Apel Cahul'
};

export default function Sedinte() {
  const [sedinte, setSedinte] = useState([]);
  const [persoane, setPersoane] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({
    persoana_id: '', instanta: '', tip_dosar: '', viitoare: '1', cautare: '', page: 1, sort: 'data_sedinta_iso', order: 'DESC'
  });

  useEffect(() => {
    apiFetch('/persoane').then(setPersoane).catch(() => {});
  }, []);

  const fetchSedinte = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });

    apiFetch(`/sedinte?${params}`)
      .then(data => {
        setSedinte(data.data);
        setTotal(data.total);
        setPages(data.pages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { fetchSedinte(); }, [fetchSedinte]);

  function toggleSort(col) {
    setFilters(f => ({
      ...f,
      sort: col,
      order: f.sort === col && f.order === 'DESC' ? 'ASC' : 'DESC',
      page: 1
    }));
  }

  function handleExport() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v && k !== 'page' && k !== 'sort' && k !== 'order') params.set(k, v); });
    const token = localStorage.getItem('monitor_token');
    const base = (import.meta.env.BASE_URL || '/') + 'api';
    window.open(`${base}/sedinte/export?${params}&token=${token}`, '_blank');
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Sedinte</h1>
        <button onClick={handleExport} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          Exporta CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={filters.persoana_id}
            onChange={e => setFilters(f => ({ ...f, persoana_id: e.target.value, page: 1 }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="">Toate persoanele</option>
            {persoane.map(p => <option key={p.id} value={p.id}>{p.nume}</option>)}
          </select>

          <select
            value={filters.instanta}
            onChange={e => setFilters(f => ({ ...f, instanta: e.target.value, page: 1 }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="">Toate instantele</option>
            {Object.entries(INSTANTE).map(([cod, nume]) => <option key={cod} value={cod}>{nume}</option>)}
          </select>

          <select
            value={filters.tip_dosar}
            onChange={e => setFilters(f => ({ ...f, tip_dosar: e.target.value, page: 1 }))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="">Toate tipurile</option>
            <option value="Civil">Civil</option>
            <option value="Penal">Penal</option>
            <option value="Contravention">Contraventional</option>
          </select>

          <label className="flex items-center gap-2 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={filters.viitoare === '1'}
              onChange={e => setFilters(f => ({ ...f, viitoare: e.target.checked ? '1' : '', page: 1 }))}
              className="rounded border-slate-300"
            />
            Doar viitoare
          </label>

          <input
            type="text"
            value={filters.cautare}
            onChange={e => setFilters(f => ({ ...f, cautare: e.target.value, page: 1 }))}
            placeholder="Cauta..."
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {[
                  { key: 'data_sedinta_iso', label: 'Data' },
                  { key: 'ora', label: 'Ora' },
                  { key: 'instanta_cod', label: 'Instanta' },
                  { key: 'numar_dosar', label: 'Nr. Dosar' },
                  { key: null, label: 'Denumire' },
                  { key: 'judecator', label: 'Judecator' },
                  { key: 'tip_dosar', label: 'Tip' },
                  { key: null, label: 'Rezultat' },
                  { key: null, label: '' }
                ].map((col, i) => (
                  <th
                    key={i}
                    onClick={() => col.key && toggleSort(col.key)}
                    className={`px-3 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${col.key ? 'cursor-pointer hover:text-slate-700' : ''}`}
                  >
                    {col.label}
                    {col.key && filters.sort === col.key && (
                      <span className="ml-1">{filters.order === 'ASC' ? '\u2191' : '\u2193'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">Se incarca...</td></tr>
              ) : sedinte.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400">Nicio sedinta gasita</td></tr>
              ) : sedinte.map(s => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${
                    s.data_sedinta_iso === today ? 'bg-amber-50' : ''
                  }`}
                >
                  <td className="px-3 py-2.5 whitespace-nowrap font-medium">{s.data_sedinta}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{s.ora}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">{s.instanta_nume}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{s.numar_dosar}</td>
                  <td className="px-3 py-2.5 max-w-[200px] truncate" title={s.denumire_dosar}>{s.denumire_dosar}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{s.judecator}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                      s.tip_dosar === 'Penal' ? 'bg-red-100 text-red-700' :
                      s.tip_dosar === 'Civil' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {s.tip_dosar || '-'}
                    </span>
                    {s.modificari_recente?.length > 0 && (
                      <span className="ml-1 inline-flex px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-600">modificat</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 max-w-[150px] truncate text-xs" title={s.rezultat}>{s.rezultat || '-'}</td>
                  <td className="px-3 py-2.5">
                    {s.pdf_link && (
                      <a href={s.pdf_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline text-xs">
                        PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">{total} sedinte total</span>
            <div className="flex gap-1">
              <button
                onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                disabled={filters.page <= 1}
                className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              >
                Inapoi
              </button>
              <span className="px-3 py-1 text-sm">{filters.page} / {pages}</span>
              <button
                onClick={() => setFilters(f => ({ ...f, page: Math.min(pages, f.page + 1) }))}
                disabled={filters.page >= pages}
                className="px-3 py-1 text-sm border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50"
              >
                Inainte
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Detalii sedinta</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="Persoana" value={selected.persoana_nume} />
              <Row label="Nr. Dosar" value={selected.numar_dosar} />
              <Row label="Data" value={`${selected.data_sedinta} ora ${selected.ora || '-'}`} />
              <Row label="Instanta" value={selected.instanta_nume} />
              <Row label="Judecator" value={selected.judecator} />
              <Row label="Sala" value={selected.sala} />
              <Row label="Denumire" value={selected.denumire_dosar} />
              <Row label="Obiect" value={selected.obiect_cauza} />
              <Row label="Tip dosar" value={selected.tip_dosar} />
              <Row label="Tip sedinta" value={selected.tip_sedinta} />
              <Row label="Rezultat" value={selected.rezultat} />
              {selected.pdf_link && (
                <Row label="PDF" value={<a href={selected.pdf_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Descarca PDF</a>} />
              )}
              <Row label="Prima detectare" value={selected.prima_detectare} />
              <Row label="Ultima verificare" value={selected.ultima_verificare} />
            </div>

            {selected.modificari_recente?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Modificari recente</h3>
                {selected.modificari_recente.map((m, i) => (
                  <div key={i} className="text-xs bg-amber-50 rounded p-2 mb-1">
                    <span className="font-medium">{m.camp_modificat}</span>: {m.valoare_veche || '-'} → {m.valoare_noua || '-'}
                    <span className="text-slate-400 ml-2">{m.detectat_la}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex">
      <span className="w-32 flex-shrink-0 text-slate-500">{label}</span>
      <span className="text-slate-900">{value || '-'}</span>
    </div>
  );
}
