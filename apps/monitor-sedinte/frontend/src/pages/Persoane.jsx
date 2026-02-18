import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

const INSTANTE = {
  jc: 'Judecatoria Chisinau', jsr: 'Judecatoria Soroca', jbl: 'Judecatoria Balti',
  jch: 'Judecatoria Cahul', jcm: 'Judecatoria Comrat', jed: 'Judecatoria Edinet',
  jhn: 'Judecatoria Hincesti', jun: 'Judecatoria Ungheni', jor: 'Judecatoria Orhei',
  jcs: 'Judecatoria Causeni', jst: 'Judecatoria Straseni', jcl: 'Judecatoria Calarasi',
  jan: 'Judecatoria Anenii Noi', jri: 'Judecatoria Rezina', cac: 'Curtea de Apel Chisinau',
  cab: 'Curtea de Apel Balti', cach: 'Curtea de Apel Cahul'
};

const ALL_CODES = Object.keys(INSTANTE);

const emptyForm = { nume: '', instante: [...ALL_CODES], tip_dosar: 'Any', nota: '' };

export default function Persoane() {
  const [persoane, setPersoane] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);

  function fetchPersoane() {
    setLoading(true);
    apiFetch('/persoane')
      .then(setPersoane)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchPersoane(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({ nume: p.nume, instante: p.instante, tip_dosar: p.tip_dosar, nota: p.nota || '' });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.nume.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/persoane/${editing.id}`, { method: 'PUT', body: form });
      } else {
        await apiFetch('/persoane', { method: 'POST', body: form });
      }
      setShowForm(false);
      fetchPersoane();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(p) {
    await apiFetch(`/persoane/${p.id}`, { method: 'PUT', body: { activ: p.activ ? 0 : 1 } });
    fetchPersoane();
  }

  async function handleVerify(p) {
    setVerifyingId(p.id);
    try {
      await apiFetch(`/persoane/${p.id}/verificare`, { method: 'POST', body: {} });
    } catch {
      // ignore
    } finally {
      setTimeout(() => { setVerifyingId(null); fetchPersoane(); }, 2000);
    }
  }

  function toggleInstanta(cod) {
    setForm(f => {
      const instante = f.instante.includes(cod)
        ? f.instante.filter(c => c !== cod)
        : [...f.instante, cod];
      return { ...f, instante };
    });
  }

  function selectAllInstante() {
    setForm(f => ({ ...f, instante: f.instante.length === ALL_CODES.length ? [] : [...ALL_CODES] }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Persoane monitorizate</h1>
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
          Adauga persoana
        </button>
      </div>

      {persoane.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400">Nicio persoana monitorizata</p>
          <button onClick={openAdd} className="mt-3 text-sm text-blue-600 hover:underline">Adauga prima persoana</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {persoane.map(p => (
            <div key={p.id} className={`bg-white rounded-xl border border-slate-200 p-5 ${!p.activ ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{p.nume}</h3>
                  {p.nota && <p className="text-xs text-slate-500 mt-0.5">{p.nota}</p>}
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${p.activ ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {p.activ ? 'Activ' : 'Inactiv'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {p.instante.length === ALL_CODES.length ? (
                  <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">Toate instantele</span>
                ) : (
                  p.instante.slice(0, 5).map(cod => (
                    <span key={cod} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">{cod}</span>
                  ))
                )}
                {p.instante.length > 5 && p.instante.length !== ALL_CODES.length && (
                  <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-400 rounded">+{p.instante.length - 5}</span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                <span>Tip: {p.tip_dosar}</span>
                <span>Sedinte viitoare: <strong className="text-slate-700">{p.sedinte_viitoare}</strong></span>
              </div>
              {p.ultima_verificare && (
                <div className="text-xs text-slate-400 mb-3">Ultima verificare: {p.ultima_verificare}</div>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button onClick={() => openEdit(p)} className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50">Editare</button>
                <button onClick={() => handleToggle(p)} className="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-50">
                  {p.activ ? 'Dezactiveaza' : 'Activeaza'}
                </button>
                <button
                  onClick={() => handleVerify(p)}
                  disabled={verifyingId === p.id}
                  className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50"
                >
                  {verifyingId === p.id ? 'Se verifica...' : 'Verifica acum'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Editeaza persoana' : 'Adauga persoana'}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nume *</label>
                <input
                  type="text"
                  value={form.nume}
                  onChange={e => setForm(f => ({ ...f, nume: e.target.value }))}
                  placeholder="ex: Popescu Ion"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  autoFocus
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Instante</label>
                  <button onClick={selectAllInstante} className="text-xs text-blue-600 hover:underline">
                    {form.instante.length === ALL_CODES.length ? 'Deselecteaza toate' : 'Selecteaza toate'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
                  {Object.entries(INSTANTE).map(([cod, nume]) => (
                    <label key={cod} className="flex items-center gap-2 text-xs py-1 px-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.instante.includes(cod)}
                        onChange={() => toggleInstanta(cod)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-slate-600">{nume}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">{form.instante.length} selectate</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tip dosar</label>
                <select
                  value={form.tip_dosar}
                  onChange={e => setForm(f => ({ ...f, tip_dosar: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="Any">Toate</option>
                  <option value="Civil">Civil</option>
                  <option value="Penal">Penal</option>
                  <option value="Contravention">Contraventional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nota (optional)</label>
                <textarea
                  value={form.nota}
                  onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
                  placeholder="ex: fratele lui Vasile"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                Anuleaza
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nume.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Se salveaza...' : editing ? 'Salveaza' : 'Adauga'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
