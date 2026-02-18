import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export default function Setari() {
  const [setari, setSetari] = useState({});
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSaving, setWebhookSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch('/setari'),
      apiFetch('/setari/status'),
      apiFetch('/verificare/log?limit=50')
    ]).then(([s, st, l]) => {
      setSetari(s);
      setStatus(st);
      setLogs(l.data);
      setWebhookUrl(s.webhook_url || '');
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleVerify() {
    setVerifying(true);
    try {
      await apiFetch('/verificare/acum', { method: 'POST', body: {} });
    } catch {
      // ignore
    }
    setTimeout(() => {
      setVerifying(false);
      apiFetch('/verificare/log?limit=50').then(l => setLogs(l.data)).catch(() => {});
      apiFetch('/setari/status').then(setStatus).catch(() => {});
    }, 5000);
  }

  async function handleTestTelegram() {
    setTestingTelegram(true);
    try {
      await apiFetch('/setari', { method: 'PUT', body: { setari: { test_telegram: 'true' } } });
      alert('Mesajul de test a fost trimis!');
    } catch (err) {
      alert('Eroare: ' + err.message);
    } finally {
      setTestingTelegram(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Setari</h1>

      {/* Telegram section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-medium text-slate-700 mb-4">Bot Telegram</h2>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${setari.telegram_configured ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-sm text-slate-600">
            {setari.telegram_configured ? 'Configurat' : 'Neconfigurat — setati TELEGRAM_BOT_TOKEN si TELEGRAM_CHAT_ID in .env'}
          </span>
        </div>
        {setari.telegram_configured && (
          <button
            onClick={handleTestTelegram}
            disabled={testingTelegram}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {testingTelegram ? 'Se trimite...' : 'Trimite mesaj de test'}
          </button>
        )}
      </div>

      {/* Webhook section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-medium text-slate-700 mb-4">Webhook Notificari</h2>
        <p className="text-xs text-slate-500 mb-3">
          URL unde se vor trimite notificari POST JSON la fiecare sedinta/hotarare noua sau modificare.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://example.com/webhook"
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={async () => {
              setWebhookSaving(true);
              try {
                await apiFetch('/setari', { method: 'PUT', body: { setari: { webhook_url: webhookUrl } } });
                alert('Webhook salvat!');
              } catch (err) {
                alert('Eroare: ' + err.message);
              } finally {
                setWebhookSaving(false);
              }
            }}
            disabled={webhookSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {webhookSaving ? 'Se salveaza...' : 'Salveaza'}
          </button>
        </div>
        {webhookUrl && (
          <div className="mt-3 text-xs text-slate-500">
            <p className="font-medium mb-1">Evenimente trimise:</p>
            <ul className="list-disc ml-4 space-y-0.5">
              <li><code className="bg-slate-100 px-1 rounded">sedinta_noua</code> — sedinta noua detectata</li>
              <li><code className="bg-slate-100 px-1 rounded">sedinta_modificata</code> — modificare sedinta</li>
              <li><code className="bg-slate-100 px-1 rounded">hotarare_noua</code> — hotarare/incheiere noua</li>
            </ul>
          </div>
        )}
      </div>

      {/* Schedule section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-medium text-slate-700 mb-4">Programare automata</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Verificare dimineata</p>
            <p className="text-sm font-medium text-slate-900">{setari.cron_morning || '07:00'}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Verificare seara</p>
            <p className="text-sm font-medium text-slate-900">{setari.cron_evening || '19:00'}</p>
          </div>
        </div>
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          {verifying ? 'Verificare in curs...' : 'Verifica acum'}
        </button>
      </div>

      {/* System status */}
      {status && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-medium text-slate-700 mb-4">Status sistem</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatusItem label="Uptime" value={formatUptime(status.uptime)} />
            <StatusItem label="Node.js" value={status.node_version} />
            <StatusItem label="Persoane" value={status.total_persoane} />
            <StatusItem label="Total sedinte" value={status.total_sedinte} />
            <StatusItem label="Sedinte viitoare" value={status.sedinte_viitoare} />
            <StatusItem label="Verificari 24h" value={status.verificari_24h} />
            <StatusItem label="Ultima verificare" value={status.ultima_verificare || 'niciodata'} />
            <StatusItem label="Telegram" value={status.telegram_configured ? 'Da' : 'Nu'} />
          </div>
        </div>
      )}

      {/* Verification log */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-medium text-slate-700 mb-4">Jurnal verificari</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Data</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Persoana</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Instanta</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Gasite</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Noi</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Erori</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Durata</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-4 text-slate-400">Nicio inregistrare</td></tr>
              ) : logs.map(l => (
                <tr key={l.id} className="border-b border-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{l.timestamp}</td>
                  <td className="px-3 py-2">{l.persoana_nume || '-'}</td>
                  <td className="px-3 py-2">{l.instanta_cod || '-'}</td>
                  <td className="px-3 py-2">{l.sedinte_gasite}</td>
                  <td className="px-3 py-2">
                    {l.sedinte_noi > 0 ? <span className="text-green-600 font-medium">{l.sedinte_noi}</span> : '0'}
                  </td>
                  <td className="px-3 py-2">
                    {l.eroare ? <span className="text-red-500 text-xs" title={l.eroare}>Eroare</span> : '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">{l.durata_ms}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
