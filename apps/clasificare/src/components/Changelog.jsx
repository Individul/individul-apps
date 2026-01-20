import { useState } from 'react'

// Tipuri de modificări cu iconițe și culori
const CHANGE_TYPES = {
  feature: {
    icon: '✨',
    label: 'NOU',
    bg: 'bg-green-100 text-green-800',
    border: 'border-green-300'
  },
  improvement: {
    icon: '🔧',
    label: 'ÎMBUNĂTĂȚIRI',
    bg: 'bg-blue-100 text-blue-800',
    border: 'border-blue-300'
  },
  fix: {
    icon: '🐛',
    label: 'REMEDIERI',
    bg: 'bg-yellow-100 text-yellow-800',
    border: 'border-yellow-300'
  },
  deprecated: {
    icon: '⚠️',
    label: 'DEPRECIAT',
    bg: 'bg-red-100 text-red-800',
    border: 'border-red-300'
  }
}

// Istoricul modificărilor aplicației
const CHANGELOG_DATA = [
  {
    version: '1.2.1',
    date: '18.01.2026',
    title: 'Corectare calcul arest preventiv',
    changes: [
      { type: 'fix', text: 'Regula [start, end): include ziua de început, exclude ziua de sfârșit' },
      { type: 'fix', text: 'Exemplu: 29.01.2015 - 29.04.2015 = 90 zile (corect)' }
    ]
  },
  {
    version: '1.2.0',
    date: '16.01.2026',
    title: 'Actualizare metodologie calcul conform regulilor RM',
    changes: [
      { type: 'feature', text: 'Calculul exact al fracțiilor din termenul total (ani/luni/zile)' },
      { type: 'feature', text: 'Formula sfârșitului termenului: data_început + termen - arest_preventiv - 1 zi' },
      { type: 'feature', text: 'Perioada arestului preventiv se scade din fracții și din sfârșitul termenului' },
      { type: 'improvement', text: 'Afișare detaliată a calculului fracției pentru Art. 91 și Art. 92' },
      { type: 'improvement', text: 'Text îmbunătățit pentru copiere cu informații complete' }
    ]
  },
  {
    version: '1.1.0',
    date: '15.01.2026',
    title: 'Îmbunătățiri UI și Corectări',
    changes: [
      { type: 'fix', text: 'Eticheta Art. 92: "Data înlocririi" → "Data eligibilității"' },
      { type: 'improvement', text: 'Simplificare footer - eliminat textul duplicat' },
      { type: 'improvement', text: 'Adăugat notice pentru copyright' }
    ]
  },
  {
    version: '1.0.0',
    date: '14.01.2026',
    title: 'Lansare inițială',
    changes: [
      { type: 'feature', text: 'Determinarea categoriei infracțiunilor din Codul Penal RM' },
      { type: 'feature', text: 'Calculul fracțiilor pentru Art. 91 și Art. 92' },
      { type: 'feature', text: 'Selector categorie de vârstă (minor, tânăr, adult, vârstnic)' },
      { type: 'feature', text: 'Calculator termene cu dată start, termen și arest preventiv' },
      { type: 'feature', text: 'Tabelul fracțiunilor conform CP RM' },
      { type: 'feature', text: 'Export și copiere rezultate' }
    ]
  }
]

export default function Changelog({ onClose }) {
  const [expandedVersion, setExpandedVersion] = useState(0) // Prima versiune deschisă implicit

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <div>
                <h2 className="text-xl font-bold">Changelog</h2>
                <p className="text-purple-100 text-sm">Istoricul modificărilor</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 flex items-center justify-center transition-colors"
              aria-label="Închide"
            >
              ×
            </button>
          </div>
        </div>

        {/* Legendă tipuri modificări */}
        <div className="px-6 py-3 bg-gray-50 border-b flex flex-wrap gap-3 text-xs">
          {Object.entries(CHANGE_TYPES).map(([key, { icon, label, bg }]) => (
            <span key={key} className={`flex items-center gap-1 px-2 py-1 rounded ${bg}`}>
              <span>{icon}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {CHANGELOG_DATA.map((entry, index) => {
            const isExpanded = expandedVersion === index

            return (
              <div
                key={entry.version}
                className={`border-2 rounded-xl overflow-hidden transition-all ${
                  isExpanded ? 'border-purple-300 shadow-md' : 'border-gray-200'
                }`}
              >
                {/* Version Header - Clickable */}
                <button
                  onClick={() => setExpandedVersion(isExpanded ? null : index)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="bg-purple-600 text-white font-bold px-3 py-1 rounded-lg text-sm">
                      v{entry.version}
                    </span>
                    <span className="text-gray-600 text-sm">{entry.date}</span>
                    <span className="text-gray-800 font-medium hidden sm:inline">{entry.title}</span>
                  </div>
                  <span className={`transform transition-transform text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t bg-white">
                    <h3 className="font-semibold text-gray-800 mb-3">{entry.title}</h3>
                    <ul className="space-y-2">
                      {entry.changes.map((change, i) => {
                        const changeType = CHANGE_TYPES[change.type]
                        return (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <span className={changeType.bg + ' px-2 py-0.5 rounded text-xs'}>
                              {changeType.icon} {changeType.label}
                            </span>
                            <span className="text-gray-700 flex-1">{change.text}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Versiunea curentă: <strong className="text-purple-600">1.2.1</strong>
            </span>
            <span className="text-gray-500">{CHANGELOG_DATA.length} versiuni</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Componentă buton pentru deschidere changelog
export function ChangelogButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full p-4 shadow-lg transition-all hover:scale-110"
      title="Vezi changelog"
      aria-label="Deschide changelog"
    >
      <span className="text-xl">📋</span>
    </button>
  )
}
