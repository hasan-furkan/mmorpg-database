import { useMemo, useState } from 'react'
import { useWorldStore } from '../store/useWorldStoreV2'
import type { DynamicField, FieldType, FieldValue } from '../types/domain'

const fieldTypeOptions: FieldType[] = ['string', 'number', 'boolean', 'image', 'enum', 'object', 'stringArray', 'objectArray', 'numberRange']

function castInputValue(type: FieldType, value: string): FieldValue {
  if (type === 'number') return Number(value || 0)
  if (type === 'boolean') return value === 'true'
  return value
}

function renderTableValue(field: DynamicField, value: FieldValue) {
  if (field.type === 'image' && typeof value === 'string' && value) return <img src={value} alt={field.label} className="h-10 w-10 rounded object-cover" />
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value)
  return String(value ?? '')
}

export function EntityManagerPanel() {
  const activeEntityId = useWorldStore((state) => state.activeEntityId)
  const entityDefinition = useWorldStore((state) =>
    state.entityDefinitions.find((entity) => entity.id === state.activeEntityId),
  )
  const bucket = useWorldStore((state) => state.entities[state.activeEntityId])
  const setFilter = useWorldStore((state) => state.setFilter)
  const addField = useWorldStore((state) => state.addField)
  const updateField = useWorldStore((state) => state.updateField)
  const removeField = useWorldStore((state) => state.removeField)
  const addRecord = useWorldStore((state) => state.addRecord)
  const selectRecord = useWorldStore((state) => state.selectRecord)
  const updateRecordMeta = useWorldStore((state) => state.updateRecordMeta)
  const updateRecordValue = useWorldStore((state) => state.updateRecordValue)
  const removeRecord = useWorldStore((state) => state.removeRecord)
  const enums = useWorldStore((state) => state.enums)
  const primaryKeyMap: Record<string, string> = {
    itemRegistry: 'itemid',
    skillRegistry: 'skillid',
    recipeRegistry: 'recipeid',
    mobRegistry: 'mobid',
    zoneRegistry: 'zoneid',
    progressionRegistry: 'progressionid',
    mountRegistry: 'mountid',
    lootTableRegistry: 'lootTableId',
  }
  const primaryKeyField = primaryKeyMap[entityDefinition?.key ?? ''] ?? 'id'

  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<FieldType>('string')
  const [newFieldEnum, setNewFieldEnum] = useState('')
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [editingType, setEditingType] = useState<FieldType>('string')
  const [editingEnum, setEditingEnum] = useState('')

  const selectedRecord = bucket.records.find((record) => record.id === bucket.selectedId) ?? null

  const filteredRecords = useMemo(() => {
    const text = bucket.filter.toLowerCase().trim()
    if (!text) return bucket.records

    return bucket.records.filter((record) => {
      const staticMatch = record.name.toLowerCase().includes(text)
      const dynamicMatch = Object.values(record.values).some((value) =>
        String(value).toLowerCase().includes(text),
      )
      return staticMatch || dynamicMatch
    })
  }, [bucket.filter, bucket.records])

  const addFieldClick = () => {
    if (!newFieldLabel.trim()) return
    addField(activeEntityId, newFieldLabel, newFieldType, newFieldType === 'enum' ? newFieldEnum : undefined)
    setNewFieldLabel('')
    setNewFieldEnum('')
  }

  const startEditField = (field: DynamicField) => {
    setEditingFieldId(field.id)
    setEditingLabel(field.label)
    setEditingType(field.type)
    setEditingEnum(field.enumKey ?? '')
  }

  const saveEditField = () => {
    if (!editingFieldId || !editingLabel.trim()) return
    updateField(activeEntityId, editingFieldId, { label: editingLabel, type: editingType, enumKey: editingEnum })
    setEditingFieldId(null)
  }

  if (!bucket || !entityDefinition) return null

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">{entityDefinition.label} Tablosu</h2>
          <button type="button" onClick={() => addRecord(activeEntityId)} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700">
            + Satır Ekle
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            value={newFieldLabel}
            onChange={(event) => setNewFieldLabel(event.target.value)}
            placeholder="Yeni sütun adı"
            className="min-w-[180px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={newFieldType}
            onChange={(event) => setNewFieldType(event.target.value as FieldType)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {fieldTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {newFieldType === 'enum' && (
            <select
              value={newFieldEnum}
              onChange={(event) => setNewFieldEnum(event.target.value)}
              className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Enum seç</option>
              {Object.keys(enums).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={addFieldClick}
            className="rounded-md border border-slate-900 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-900 hover:text-white"
          >
            Sütun Ekle
          </button>
        </div>

        <input
          value={bucket.filter}
          onChange={(event) => setFilter(activeEntityId, event.target.value)}
          placeholder="Filtrele (ad veya özellik)"
          className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />

        <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sütun Yönetimi</p>
          {bucket.fields.map((field) => (
            <div key={field.id} className="rounded-md border border-slate-200 bg-white p-2">
              {field.key === primaryKeyField && (
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                  Primary Key (zorunlu / kilitli)
                </p>
              )}
              {editingFieldId === field.id ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    value={editingLabel}
                    onChange={(event) => setEditingLabel(event.target.value)}
                    className="min-w-[140px] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <select
                    value={editingType}
                    onChange={(event) => setEditingType(event.target.value as FieldType)}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    {fieldTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {editingType === 'enum' && (
                    <select
                      value={editingEnum}
                      onChange={(event) => setEditingEnum(event.target.value)}
                      className="min-w-[220px] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">Enum seç</option>
                      {Object.keys(enums).map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </select>
                  )}
                  <button type="button" onClick={saveEditField} className="rounded bg-slate-900 px-2 py-1 text-xs text-white">
                    Kaydet
                  </button>
                  <button type="button" onClick={() => setEditingFieldId(null)} className="rounded border px-2 py-1 text-xs">
                    İptal
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <p className="font-medium text-slate-700">
                    {field.label} <span className="text-slate-400">({field.type})</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditField(field)}
                      className="text-xs text-blue-700"
                      disabled={field.key === primaryKeyField}
                    >
                      düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(activeEntityId, field.id)}
                      className="text-xs text-red-600"
                      disabled={field.key === primaryKeyField}
                    >
                      sil
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 font-medium text-slate-700">Ad</th>
                {bucket.fields.map((field) => (
                  <th key={field.id} className="px-3 py-2 font-medium text-slate-700">
                    {field.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, index) => (
                <tr
                  key={`${record.id}-${index}`}
                  onClick={() => selectRecord(activeEntityId, record.id)}
                  className={`cursor-pointer border-t border-slate-200 ${
                    record.id === bucket.selectedId ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-3 py-2">{record.name}</td>
                  {bucket.fields.map((field) => (
                    <td key={field.id} className="px-3 py-2">
                      {renderTableValue(field, record.values[field.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Kayıt Detayı</h2>
        {!selectedRecord && (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            Detay düzenlemek için bir satır seç.
          </p>
        )}

        {selectedRecord && (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Ad</span>
              <input
                value={selectedRecord.name}
                onChange={(event) =>
                  updateRecordMeta(activeEntityId, selectedRecord.id, { name: event.target.value })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            {bucket.fields.map((field) => (
              <label key={field.id} className="block text-sm">
                <span className="mb-1 block text-slate-600">{field.label}</span>
                {(field.type === 'string' || field.type === 'number' || field.type === 'image') && (
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={String(selectedRecord.values[field.key] ?? '')}
                    onChange={(event) =>
                      updateRecordValue(
                        activeEntityId,
                        selectedRecord.id,
                        field.key,
                        castInputValue(field.type, event.target.value),
                      )
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                    required={field.key === primaryKeyField}
                  />
                )}
                {field.type === 'boolean' && (
                  <select
                    value={String(selectedRecord.values[field.key] ?? false)}
                    onChange={(event) =>
                      updateRecordValue(
                        activeEntityId,
                        selectedRecord.id,
                        field.key,
                        castInputValue(field.type, event.target.value),
                      )
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  >
                    <option value="false">false</option>
                    <option value="true">true</option>
                  </select>
                )}
                {field.type === 'enum' && (
                  <select
                    value={String(selectedRecord.values[field.key] ?? '')}
                    onChange={(event) =>
                      updateRecordValue(activeEntityId, selectedRecord.id, field.key, event.target.value)
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  >
                    {(enums[field.enumKey ?? ''] ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
                {field.type === 'object' && (
                  <div className="space-y-2 rounded-md border border-slate-200 p-2">
                    {Object.entries(field.objectShape ?? {}).map(([objectKey, objectType]) => (
                      <input
                        key={objectKey}
                        type={objectType === 'number' ? 'number' : 'text'}
                        placeholder={objectKey}
                        value={String((selectedRecord.values[field.key] as Record<string, unknown>)?.[objectKey] ?? '')}
                        onChange={(event) =>
                          updateRecordValue(activeEntityId, selectedRecord.id, field.key, {
                            ...(selectedRecord.values[field.key] as Record<string, unknown>),
                            [objectKey]: objectType === 'number' ? Number(event.target.value) : event.target.value,
                          } as FieldValue)
                        }
                        className="w-full rounded-md border border-slate-300 px-2 py-2"
                      />
                    ))}
                  </div>
                )}
                {field.type === 'numberRange' && (
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((idx) => (
                      <input
                        key={idx}
                        type="number"
                        value={String((selectedRecord.values[field.key] as [number, number])?.[idx] ?? 0)}
                        onChange={(event) => {
                          const current = [...((selectedRecord.values[field.key] as [number, number]) ?? [0, 0])] as [number, number]
                          current[idx] = Number(event.target.value)
                          updateRecordValue(activeEntityId, selectedRecord.id, field.key, current)
                        }}
                        className="rounded-md border border-slate-300 px-2 py-2"
                      />
                    ))}
                  </div>
                )}
                {field.type === 'stringArray' && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {((selectedRecord.values[field.key] as string[]) ?? []).map((entry, index) => (
                        <span key={`${entry}-${index}`} className="rounded bg-slate-100 px-2 py-1 text-xs">
                          {entry}
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...((selectedRecord.values[field.key] as string[]) ?? [])]
                              next.splice(index, 1)
                              updateRecordValue(activeEntityId, selectedRecord.id, field.key, next)
                            }}
                            className="ml-2 text-red-600"
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const value = prompt('Değer gir')
                        if (!value) return
                        updateRecordValue(activeEntityId, selectedRecord.id, field.key, [...((selectedRecord.values[field.key] as string[]) ?? []), value])
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      {field.addLabel ?? 'Ekle'}
                    </button>
                  </div>
                )}
                {field.type === 'objectArray' && (
                  <div className="space-y-2">
                    {((selectedRecord.values[field.key] as Record<string, unknown>[]) ?? []).map((entry, idx) => (
                      <div key={idx} className="rounded-md border border-slate-200 p-2">
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(field.itemShape ?? {}).map(([itemKey, itemType]) => (
                            <input
                              key={itemKey}
                              type={itemType === 'number' ? 'number' : 'text'}
                              placeholder={itemKey}
                              value={String(entry[itemKey] ?? '')}
                              onChange={(event) => {
                                const rows = [...((selectedRecord.values[field.key] as Record<string, unknown>[]) ?? [])]
                                rows[idx] = {
                                  ...rows[idx],
                                  [itemKey]: itemType === 'number' ? Number(event.target.value) : event.target.value,
                                }
                                updateRecordValue(activeEntityId, selectedRecord.id, field.key, rows as unknown as FieldValue)
                              }}
                              className="rounded-md border border-slate-300 px-2 py-2"
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const rows = [...((selectedRecord.values[field.key] as Record<string, unknown>[]) ?? [])]
                            rows.splice(idx, 1)
                            updateRecordValue(activeEntityId, selectedRecord.id, field.key, rows as unknown as FieldValue)
                          }}
                          className="mt-2 text-xs text-red-600"
                        >
                          Satırı Sil
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const empty = Object.fromEntries(
                          Object.entries(field.itemShape ?? {}).map(([k, t]) => [k, t === 'number' ? 0 : t === 'boolean' ? false : '']),
                        )
                        updateRecordValue(
                          activeEntityId,
                          selectedRecord.id,
                          field.key,
                          [...((selectedRecord.values[field.key] as Record<string, unknown>[]) ?? []), empty] as unknown as FieldValue,
                        )
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      {field.addLabel ?? 'Satır Ekle'}
                    </button>
                  </div>
                )}
                {field.type === 'image' && typeof selectedRecord.values[field.key] === 'string' && selectedRecord.values[field.key] && (
                  <img
                    src={String(selectedRecord.values[field.key])}
                    alt={field.label}
                    className="mt-2 h-28 w-full rounded-md border border-slate-200 object-cover"
                  />
                )}
              </label>
            ))}

            <button
              type="button"
              onClick={() => removeRecord(activeEntityId, selectedRecord.id)}
              className="w-full rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Kaydı Sil
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
