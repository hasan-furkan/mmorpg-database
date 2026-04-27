import { useRef, useState, type ChangeEvent } from 'react'
import { EntityManagerPanel } from './components/EntityManagerPanel'
import { UniverseGraphPanel } from './components/UniverseGraphPanel'
import { useWorldStore } from './store/useWorldStoreV2'

function App() {
  const [newEntityLabel, setNewEntityLabel] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const activeEntityId = useWorldStore((state) => state.activeEntityId)
  const setActiveEntity = useWorldStore((state) => state.setActiveEntity)
  const activeView = useWorldStore((state) => state.activeView)
  const setActiveView = useWorldStore((state) => state.setActiveView)
  const entityDefinitions = useWorldStore((state) => state.entityDefinitions)
  const addEntity = useWorldStore((state) => state.addEntity)
  const removeEntity = useWorldStore((state) => state.removeEntity)
  const buildEditorJson = useWorldStore((state) => state.buildEditorJson)
  const buildRuntimeJson = useWorldStore((state) => state.buildRuntimeJson)
  const importFromJson = useWorldStore((state) => state.importFromJson)
  const runtimeJson = useWorldStore((state) => state.runtimeJson)
  const exportJson = useWorldStore((state) => state.exportJson)

  const handleCreateEntity = () => {
    if (!newEntityLabel.trim()) return
    addEntity(newEntityLabel)
    setNewEntityLabel('')
  }

  const downloadJson = () => {
    if (!exportJson) return
    const blob = new Blob([exportJson], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `mmorpg-world-${new Date().toISOString()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleEditorExport = () => {
    buildEditorJson()
  }

  const handleRuntimeExport = () => {
    const result = buildRuntimeJson()
    if (!result.ok) {
      alert(result.errors.join('\n'))
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const result = importFromJson(text)
      setImportMessage(result.message)
    } catch {
      setImportMessage('Dosya okunamadı.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Visual GDD & Database Manager</h1>
              <p className="text-sm text-slate-600">
                MMORPG eşyalarını, yaratıklarını ve bölgelerini dinamik şemalarla yönet.
              </p>
            </div>
            <button type="button" onClick={handleEditorExport} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Editor JSON İndir
            </button>
            <button type="button" onClick={handleRuntimeExport} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Runtime JSON İndir
            </button>
            <button
              type="button"
              onClick={handleImportClick}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              JSON Yükle / İçe Aktar
            </button>
            <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
          </div>
          {importMessage && <p className="mt-2 text-xs text-slate-600">{importMessage}</p>}
        </header>

        <section className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {entityDefinitions.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => setActiveEntity(entity.id)}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  activeEntityId === entity.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {entity.icon} {entity.label}
              </button>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={newEntityLabel}
                onChange={(event) => setNewEntityLabel(event.target.value)}
                placeholder="Yeni Entity (örn: Binekler)"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleCreateEntity}
                className="rounded-md border border-slate-900 px-3 py-2 text-sm font-medium text-slate-900"
              >
                + Entity
              </button>
              <button
                type="button"
                onClick={() => removeEntity(activeEntityId)}
                className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700"
              >
                Entity Sil
              </button>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => setActiveView('table')}
                className={`rounded-md px-3 py-2 text-sm ${activeView === 'table' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}
              >
                Veri Paneli
              </button>
              <button
                type="button"
                onClick={() => setActiveView('graph')}
                className={`rounded-md px-3 py-2 text-sm ${activeView === 'graph' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}
              >
                Evren Haritası
              </button>
            </div>
          </div>

          {activeView === 'table' && <EntityManagerPanel />}
          {activeView === 'graph' && <UniverseGraphPanel />}
        </section>

        {exportJson && (
          <section className="rounded-xl border border-slate-300 bg-slate-950 p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">JSON Çıktısı ({exportJson === runtimeJson ? 'Runtime' : 'Editor'})</h2>
              <button
                type="button"
                onClick={downloadJson}
                className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                İndir (.json)
              </button>
            </div>
            <pre className="max-h-80 overflow-auto rounded-md bg-black/30 p-3 text-xs text-emerald-200">
              {exportJson}
            </pre>
          </section>
        )}
      </div>
    </main>
  )
}

export default App
