import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NodeChange } from 'reactflow'
import type { DynamicField, EntityDefinition, EntityRecord, FieldType, FieldValue, Relation } from '../types/domain'

type PositionMap = Record<string, { x: number; y: number }>

interface EntityBucket {
  fields: DynamicField[]
  records: EntityRecord[]
  filter: string
  selectedId: string | null
}

interface WorldState {
  activeEntityId: string
  activeView: 'table' | 'graph'
  entities: Record<string, EntityBucket>
  entityDefinitions: EntityDefinition[]
  relations: Relation[]
  nodePositions: PositionMap
  exportJson: string
  relationTypes: string[]
  setActiveEntity: (entityId: string) => void
  setActiveView: (view: 'table' | 'graph') => void
  addEntity: (label: string) => void
  removeEntity: (entityId: string) => void
  setFilter: (entityId: string, filter: string) => void
  selectRecord: (entityId: string, recordId: string | null) => void
  addField: (entityId: string, label: string, type: FieldType, enumOptions?: string[]) => void
  updateField: (entityId: string, fieldId: string, patch: { label: string; type: FieldType; options?: string[] }) => void
  removeField: (entityId: string, fieldId: string) => void
  addRecord: (entityId: string) => void
  updateRecordMeta: (entityId: string, recordId: string, patch: Partial<Pick<EntityRecord, 'name'>>) => void
  updateRecordValue: (entityId: string, recordId: string, fieldKey: string, value: FieldValue) => void
  removeRecord: (entityId: string, recordId: string) => void
  setRelationType: (relationId: string, relationType: string) => void
  removeRelation: (relationId: string) => void
  onNodesChange: (changes: NodeChange[]) => void
  connectNodes: (sourceId: string, targetId: string) => void
  buildExportJson: () => void
  importFromJson: (jsonText: string) => { ok: boolean; message: string }
}

const initialDefinitions: EntityDefinition[] = [
  { id: 'entity_items', key: 'items', label: 'Eşyalar', color: '#2563eb', icon: '🧰' },
  { id: 'entity_mobs', key: 'mobs', label: 'Yaratıklar', color: '#dc2626', icon: '👾' },
  { id: 'entity_zones', key: 'zones', label: 'Bölgeler', color: '#16a34a', icon: '🗺️' },
]

const defaultFields: Record<string, DynamicField[]> = {
  entity_items: [
    { id: 'item-rarity', key: 'rarity', label: 'Nadirlik', type: 'string' },
    { id: 'item-icon', key: 'icon_url', label: 'İkon', type: 'image' },
  ],
  entity_mobs: [
    { id: 'mob-level', key: 'level', label: 'Seviye', type: 'number' },
    { id: 'mob-type', key: 'mob_type', label: 'Tür', type: 'enum', options: ['Normal', 'Boss', 'Elite'] },
  ],
  entity_zones: [
    { id: 'zone-biome', key: 'biome', label: 'Biyom', type: 'string' },
    { id: 'zone-danger', key: 'dangerLevel', label: 'Tehlike', type: 'number' },
  ],
}

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function defaultValueByType(type: FieldType): FieldValue {
  if (type === 'number') return 0
  if (type === 'boolean') return false
  return ''
}

function inferRelationType(sourceId: string, targetId: string) {
  if (sourceId.includes('mobs') && targetId.includes('items')) return 'drops_from'
  if (sourceId.includes('mobs') && targetId.includes('zones')) return 'spawns_in'
  if (sourceId.includes('zones') && targetId.includes('mobs')) return 'contains'
  return 'related_to'
}

function createBucket(fields: DynamicField[]): EntityBucket {
  return {
    fields,
    records: [],
    filter: '',
    selectedId: null,
  }
}

const relationTypes = ['drops_from', 'spawns_in', 'contains', 'requires', 'crafts_into', 'related_to']
const entityColors = ['#7c3aed', '#ea580c', '#0891b2', '#be123c', '#0284c7', '#65a30d']
const entityIcons = ['📦', '🐎', '📜', '🏰', '⚗️', '🛡️']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeImportField(field: unknown): DynamicField | null {
  if (!isObject(field)) return null
  if (typeof field.label !== 'string' || typeof field.type !== 'string') return null
  const type = field.type as FieldType
  if (!['string', 'number', 'boolean', 'image', 'enum'].includes(type)) return null

  const label = field.label.trim()
  const key = typeof field.key === 'string' && field.key.trim() ? normalizeKey(field.key) : normalizeKey(label)
  if (!label || !key) return null

  return {
    id: typeof field.id === 'string' && field.id ? field.id : id('field'),
    key,
    label,
    type,
    options:
      type === 'enum' && Array.isArray(field.options)
        ? field.options.map((option) => String(option).trim()).filter(Boolean)
        : undefined,
  }
}

function nextPositionsFromChanges(changes: NodeChange[], current: PositionMap): PositionMap {
  let changed = false
  const next = { ...current }

  changes.forEach((change) => {
    if (change.type === 'position' && change.position) {
      next[change.id] = change.position
      changed = true
    }
    if (change.type === 'remove' && next[change.id]) {
      delete next[change.id]
      changed = true
    }
  })

  return changed ? next : current
}

export const useWorldStore = create<WorldState>()(
  persist(
    (set) => ({
  activeEntityId: initialDefinitions[0].id,
  activeView: 'table',
  exportJson: '',
  nodePositions: {},
  relationTypes,
  entityDefinitions: initialDefinitions,
  entities: Object.fromEntries(initialDefinitions.map((def) => [def.id, createBucket(defaultFields[def.id] ?? [])])),
  relations: [],

  setActiveEntity: (activeEntityId) => set({ activeEntityId }),
  setActiveView: (activeView) => set({ activeView }),

  addEntity: (label) =>
    set((state) => {
      const key = normalizeKey(label)
      if (!key) return state
      const alreadyExists = state.entityDefinitions.some((entity) => entity.key === key)
      if (alreadyExists) return state

      const nextId = id(`entity_${key}`)
      const entity: EntityDefinition = {
        id: nextId,
        key,
        label: label.trim(),
        color: entityColors[state.entityDefinitions.length % entityColors.length],
        icon: entityIcons[state.entityDefinitions.length % entityIcons.length],
      }
      return {
        entityDefinitions: [...state.entityDefinitions, entity],
        entities: {
          ...state.entities,
          [entity.id]: createBucket([]),
        },
        activeEntityId: entity.id,
      }
    }),

  removeEntity: (entityId) =>
    set((state) => {
      if (state.entityDefinitions.length <= 1) return state
      const nextDefinitions = state.entityDefinitions.filter((entity) => entity.id !== entityId)
      if (nextDefinitions.length === state.entityDefinitions.length) return state

      const nextEntities = { ...state.entities }
      const recordIds = new Set((nextEntities[entityId]?.records ?? []).map((record) => record.id))
      delete nextEntities[entityId]

      return {
        entityDefinitions: nextDefinitions,
        entities: nextEntities,
        relations: state.relations.filter(
          (relation) => !recordIds.has(relation.sourceId) && !recordIds.has(relation.targetId),
        ),
        activeEntityId:
          state.activeEntityId === entityId ? nextDefinitions[0]?.id ?? state.activeEntityId : state.activeEntityId,
      }
    }),

  setFilter: (entityId, filter) =>
    set((state) => ({
      entities: {
        ...state.entities,
        [entityId]: {
          ...state.entities[entityId],
          filter,
        },
      },
    })),

  selectRecord: (entityId, recordId) =>
    set((state) => ({
      entities: {
        ...state.entities,
        [entityId]: {
          ...state.entities[entityId],
          selectedId: recordId,
        },
      },
    })),

  addField: (entityId, label, type, enumOptions = []) =>
    set((state) => {
      const key = normalizeKey(label)
      if (!key) return state

      const alreadyExists = state.entities[entityId].fields.some((field) => field.key === key)
      if (alreadyExists) return state

      const field: DynamicField = {
        id: id(`${entityId}-field`),
        key,
        label: label.trim(),
        type,
        options: type === 'enum' ? enumOptions : undefined,
      }

      const records = state.entities[entityId].records.map((record) => ({
        ...record,
        values: {
          ...record.values,
          [key]: defaultValueByType(type),
        },
      }))

      return {
        entities: {
          ...state.entities,
          [entityId]: {
            ...state.entities[entityId],
            fields: [...state.entities[entityId].fields, field],
            records,
          },
        },
      }
    }),

  updateField: (entityId, fieldId, patch) =>
    set((state) => {
      const bucket = state.entities[entityId]
      const currentField = bucket.fields.find((field) => field.id === fieldId)
      if (!currentField) return state

      const nextKey = normalizeKey(patch.label)
      if (!nextKey) return state

      const hasConflict = bucket.fields.some((field) => field.id !== fieldId && field.key === nextKey)
      if (hasConflict) return state

      const nextField: DynamicField = {
        ...currentField,
        label: patch.label.trim(),
        key: nextKey,
        type: patch.type,
        options: patch.type === 'enum' ? patch.options ?? [] : undefined,
      }

      const records = bucket.records.map((record) => {
        const previousValue = record.values[currentField.key]
        const values = { ...record.values }
        delete values[currentField.key]
        values[nextKey] =
          previousValue === undefined
            ? patch.type === 'enum'
              ? patch.options?.[0] ?? ''
              : defaultValueByType(patch.type)
            : previousValue

        return { ...record, values }
      })

      return {
        entities: {
          ...state.entities,
          [entityId]: {
            ...bucket,
            fields: bucket.fields.map((field) => (field.id === fieldId ? nextField : field)),
            records,
          },
        },
      }
    }),

  removeField: (entityId, fieldId) =>
    set((state) => {
      const field = state.entities[entityId].fields.find((currentField) => currentField.id === fieldId)
      if (!field) return state

      const records = state.entities[entityId].records.map((record) => {
        const nextValues = { ...record.values }
        delete nextValues[field.key]
        return {
          ...record,
          values: nextValues,
        }
      })

      return {
        entities: {
          ...state.entities,
          [entityId]: {
            ...state.entities[entityId],
            fields: state.entities[entityId].fields.filter((currentField) => currentField.id !== fieldId),
            records,
          },
        },
      }
    }),

  addRecord: (entityId) =>
    set((state) => {
      const fields = state.entities[entityId].fields
      const values = fields.reduce<Record<string, FieldValue>>((acc, field) => {
        acc[field.key] = field.type === 'enum' ? field.options?.[0] ?? '' : defaultValueByType(field.type)
        return acc
      }, {})
      const entity = state.entityDefinitions.find((def) => def.id === entityId)
      const record: EntityRecord = {
        id: id(`record_${entity?.key ?? entityId}`),
        name: `${entity?.label ?? 'Kayıt'} ${state.entities[entityId].records.length + 1}`,
        values,
      }

      return {
        entities: {
          ...state.entities,
          [entityId]: {
            ...state.entities[entityId],
            records: [...state.entities[entityId].records, record],
            selectedId: record.id,
          },
        },
      }
    }),

  updateRecordMeta: (entityId, recordId, patch) =>
    set((state) => ({
      entities: {
        ...state.entities,
        [entityId]: {
          ...state.entities[entityId],
          records: state.entities[entityId].records.map((record) =>
            record.id === recordId ? { ...record, ...patch } : record,
          ),
        },
      },
    })),

  updateRecordValue: (entityId, recordId, fieldKey, value) =>
    set((state) => ({
      entities: {
        ...state.entities,
        [entityId]: {
          ...state.entities[entityId],
          records: state.entities[entityId].records.map((record) =>
            record.id === recordId
              ? {
                  ...record,
                  values: {
                    ...record.values,
                    [fieldKey]: value,
                  },
                }
              : record,
          ),
        },
      },
    })),

  removeRecord: (entityId, recordId) =>
    set((state) => ({
      entities: {
        ...state.entities,
        [entityId]: {
          ...state.entities[entityId],
          records: state.entities[entityId].records.filter((record) => record.id !== recordId),
          selectedId: state.entities[entityId].selectedId === recordId ? null : state.entities[entityId].selectedId,
        },
      },
      relations: state.relations.filter((relation) => relation.sourceId !== recordId && relation.targetId !== recordId),
    })),

  setRelationType: (relationId, relationType) =>
    set((state) => ({
      relations: state.relations.map((relation) =>
        relation.id === relationId ? { ...relation, relationType } : relation,
      ),
    })),

  removeRelation: (relationId) =>
    set((state) => ({
      relations: state.relations.filter((relation) => relation.id !== relationId),
    })),

  onNodesChange: (changes) =>
    set((state) => {
      const nodePositions = nextPositionsFromChanges(changes, state.nodePositions)
      if (nodePositions === state.nodePositions) return state
      return { nodePositions }
    }),

  connectNodes: (sourceId, targetId) =>
    set((state) => {
      const duplicate = state.relations.some(
        (relation) => relation.sourceId === sourceId && relation.targetId === targetId,
      )
      if (duplicate) return state

      const relation: Relation = {
        id: id('relation'),
        sourceId,
        targetId,
        relationType: relationTypes.includes(inferRelationType(sourceId, targetId))
          ? inferRelationType(sourceId, targetId)
          : 'related_to',
      }

      return { relations: [...state.relations, relation] }
    }),

  buildExportJson: () =>
    set((state) => {
      const recordsById = new Map<string, EntityRecord>()
      state.entityDefinitions.forEach((entity) => {
        state.entities[entity.id].records.forEach((record) => recordsById.set(record.id, record))
      })

      const schemas = Object.fromEntries(
        state.entityDefinitions.map((entity) => [entity.key, state.entities[entity.id].fields]),
      )
      const world = Object.fromEntries(
        state.entityDefinitions.map((entity) => [
          entity.key,
          state.entities[entity.id].records.map((record) => {
            const outgoing = state.relations.filter((relation) => relation.sourceId === record.id)
            const incoming = state.relations.filter((relation) => relation.targetId === record.id)
            return {
              ...record,
              links: {
                outgoing: outgoing.map((relation) => ({
                  relationType: relation.relationType,
                  targetId: relation.targetId,
                })),
                incoming: incoming.map((relation) => ({
                  relationType: relation.relationType,
                  sourceId: relation.sourceId,
                })),
              },
            }
          }),
        ]),
      )

      const exportData = {
        metadata: {
          createdAt: new Date().toISOString(),
          totalRelations: state.relations.length,
          totalEntities: state.entityDefinitions.length,
        },
        entities: state.entityDefinitions,
        schemas,
        world,
        relations: state.relations.map((relation) => ({
          ...relation,
          sourceName: recordsById.get(relation.sourceId)?.name ?? relation.sourceId,
          targetName: recordsById.get(relation.targetId)?.name ?? relation.targetId,
        })),
      }

      return { exportJson: JSON.stringify(exportData, null, 2) }
    }),

  importFromJson: (jsonText) => {
    try {
      const parsed = JSON.parse(jsonText) as unknown
      if (!isObject(parsed)) return { ok: false, message: 'Geçersiz JSON yapısı.' }
      if (!Array.isArray(parsed.entities) || !isObject(parsed.schemas) || !isObject(parsed.world)) {
        return { ok: false, message: 'JSON beklenen formatta değil (entities/schemas/world eksik).' }
      }

      const incomingDefinitions: EntityDefinition[] = parsed.entities
        .map((entity) => {
          if (!isObject(entity)) return null
          if (typeof entity.key !== 'string' || typeof entity.label !== 'string') return null
          return {
            id: typeof entity.id === 'string' && entity.id ? entity.id : id('entity'),
            key: normalizeKey(entity.key),
            label: entity.label.trim(),
            color: typeof entity.color === 'string' && entity.color ? entity.color : '#475569',
            icon: typeof entity.icon === 'string' && entity.icon ? entity.icon : '📦',
          }
        })
        .filter((entity): entity is EntityDefinition => Boolean(entity))

      if (incomingDefinitions.length === 0) {
        return { ok: false, message: 'İçe aktarılabilir entity bulunamadı.' }
      }

      const schemas = parsed.schemas as Record<string, unknown>
      const world = parsed.world as Record<string, unknown>

      const nextEntities: Record<string, EntityBucket> = {}

      incomingDefinitions.forEach((entityDef) => {
        const importedFieldsRaw: unknown[] = Array.isArray(schemas[entityDef.key])
          ? (schemas[entityDef.key] as unknown[])
          : []
        const importedFields = importedFieldsRaw
          .map((field: unknown) => normalizeImportField(field))
          .filter((field): field is DynamicField => Boolean(field))

        const importedRecordsRaw: unknown[] = Array.isArray(world[entityDef.key])
          ? (world[entityDef.key] as unknown[])
          : []
        const importedRecords: EntityRecord[] = importedRecordsRaw
          .map((record: unknown) => {
            if (!isObject(record) || typeof record.name !== 'string' || !isObject(record.values)) return null
            const recordValues = record.values as Record<string, unknown>
            const values: Record<string, FieldValue> = {}
            importedFields.forEach((field) => {
              const rawValue = recordValues[field.key]
              if (field.type === 'number') values[field.key] = Number(rawValue ?? 0)
              else if (field.type === 'boolean') values[field.key] = Boolean(rawValue)
              else values[field.key] = String(rawValue ?? '')
            })
            return {
              id: typeof record.id === 'string' && record.id ? record.id : id(`record_${entityDef.key}`),
              name: record.name,
              values,
            }
          })
          .filter((record: EntityRecord | null): record is EntityRecord => Boolean(record))

        nextEntities[entityDef.id] = {
          fields: importedFields,
          records: importedRecords,
          filter: '',
          selectedId: importedRecords[0]?.id ?? null,
        }
      })

      const importedRelations: Relation[] = Array.isArray(parsed.relations)
        ? parsed.relations
            .map((relation) => {
              if (!isObject(relation)) return null
              if (typeof relation.sourceId !== 'string' || typeof relation.targetId !== 'string') return null
              return {
                id: typeof relation.id === 'string' && relation.id ? relation.id : id('relation'),
                sourceId: relation.sourceId,
                targetId: relation.targetId,
                relationType:
                  typeof relation.relationType === 'string' && relation.relationType
                    ? relation.relationType
                    : 'related_to',
              }
            })
            .filter((relation): relation is Relation => Boolean(relation))
        : []

      set({
        entityDefinitions: incomingDefinitions,
        entities: nextEntities,
        relations: importedRelations,
        nodePositions: {},
        activeEntityId: incomingDefinitions[0].id,
        exportJson: '',
      })

      return { ok: true, message: 'JSON başarıyla içe aktarıldı.' }
    } catch {
      return { ok: false, message: 'JSON dosyası okunamadı.' }
    }
  },
}),
    {
      name: 'mmorpg-visual-gdd-store',
      partialize: (state) => ({
        activeEntityId: state.activeEntityId,
        activeView: state.activeView,
        entities: state.entities,
        entityDefinitions: state.entityDefinitions,
        relations: state.relations,
        nodePositions: state.nodePositions,
      }),
    },
  ),
)
