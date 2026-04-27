import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NodeChange } from 'reactflow'
import { z } from 'zod'
import type {
  DynamicField,
  EntityDefinition,
  EntityRecord,
  FieldType,
  FieldValue,
  NestedFieldValue,
  Relation,
} from '../types/domain'

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
  enums: Record<string, string[]>
  editorJson: string
  runtimeJson: string
  setActiveEntity: (entityId: string) => void
  setActiveView: (view: 'table' | 'graph') => void
  addEntity: (label: string) => void
  removeEntity: (entityId: string) => void
  setFilter: (entityId: string, filter: string) => void
  selectRecord: (entityId: string, recordId: string | null) => void
  addField: (entityId: string, label: string, type: FieldType, enumKey?: string) => void
  updateField: (entityId: string, fieldId: string, patch: { label: string; type: FieldType; enumKey?: string }) => void
  removeField: (entityId: string, fieldId: string) => void
  addRecord: (entityId: string) => void
  updateRecordMeta: (entityId: string, recordId: string, patch: Partial<Pick<EntityRecord, 'name'>>) => void
  updateRecordValue: (entityId: string, recordId: string, fieldKey: string, value: FieldValue) => void
  removeRecord: (entityId: string, recordId: string) => void
  setRelationType: (relationId: string, relationType: string) => void
  removeRelation: (relationId: string) => void
  onNodesChange: (changes: NodeChange[]) => void
  connectNodes: (sourceId: string, targetId: string) => void
  buildEditorJson: () => void
  buildRuntimeJson: () => { ok: boolean; errors: string[] }
  importFromJson: (jsonText: string) => { ok: boolean; message: string }
}

const initialDefinitions: EntityDefinition[] = [
  { id: 'entity_items', key: 'items', label: 'Eşyalar', color: '#2563eb', icon: '🧰' },
  { id: 'entity_equipment', key: 'equipment', label: 'Ekipman', color: '#7c3aed', icon: '⚔️' },
  { id: 'entity_zones', key: 'zones', label: 'Bölgeler', color: '#16a34a', icon: '🗺️' },
]

const defaultFields: Record<string, DynamicField[]> = {
  entity_items: [
    { id: 'item-itemid', key: 'itemid', label: 'Item ID', type: 'string' },
    { id: 'item-rarity', key: 'rarity', label: 'Nadirlik', type: 'string' },
    { id: 'item-kind', key: 'kind', label: 'Kind', type: 'enum', enumKey: 'ItemKind' },
    { id: 'item-stack', key: 'stack', label: 'Stack', type: 'stack' },
    { id: 'item-assets', key: 'assets', label: 'Assets', type: 'assets' },
  ],
  entity_equipment: [
    { id: 'eq-itemid', key: 'itemid', label: 'Item ID', type: 'string' },
    { id: 'eq-category', key: 'category', label: 'Category', type: 'enum', enumKey: 'EquipmentCategory' },
    { id: 'eq-assets', key: 'assets', label: 'Assets', type: 'assets' },
    { id: 'eq-stats', key: 'stats', label: 'Stats', type: 'stats' },
  ],
  entity_zones: [
    { id: 'zone-id', key: 'zoneid', label: 'Zone ID', type: 'string' },
    { id: 'zone-biome', key: 'biome', label: 'Biyom', type: 'string' },
    { id: 'zone-pvp', key: 'pvpType', label: 'PvP Türü', type: 'enum', enumKey: 'PvPType' },
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
  if (type === 'stack') return { enabled: false, max: 0, group: '' }
  if (type === 'assets') return { icon: '', mesh: '', animation: '', sound: '' }
  if (type === 'stats') return { physicalDamage: 0, magicDamage: 0 }
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
const globalEnums = {
  ItemKind: ['RESOURCE', 'EQUIPMENT', 'CONSUMABLE', 'QUEST'],
  EquipmentCategory: ['Weapon', 'Armor', 'Accessory'],
  PvPType: ['Safe', 'Open', 'DuelOnly'],
}
const entityColors = ['#7c3aed', '#ea580c', '#0891b2', '#be123c', '#0284c7', '#65a30d']
const entityIcons = ['📦', '🐎', '📜', '🏰', '⚗️', '🛡️']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeImportField(field: unknown): DynamicField | null {
  if (!isObject(field)) return null
  if (typeof field.label !== 'string' || typeof field.type !== 'string') return null
  const type = field.type as FieldType
  if (!['string', 'number', 'boolean', 'image', 'enum', 'stack', 'assets', 'stats'].includes(type)) return null

  const label = field.label.trim()
  const key = typeof field.key === 'string' && field.key.trim() ? normalizeKey(field.key) : normalizeKey(label)
  if (!label || !key) return null

  return {
    id: typeof field.id === 'string' && field.id ? field.id : id('field'),
    key,
    label,
    type,
    enumKey: typeof field.enumKey === 'string' ? field.enumKey : undefined,
  }
}

function getPrimaryKeyField(entityKey: string): string {
  if (entityKey === 'items' || entityKey === 'equipment') return 'itemid'
  if (entityKey === 'zones') return 'zoneid'
  return 'id'
}

function syncEquipmentWithItems(
  entities: Record<string, EntityBucket>,
  entityDefinitions: EntityDefinition[],
): Record<string, EntityBucket> {
  const itemEntity = entityDefinitions.find((entity) => entity.key === 'items')
  const equipmentEntity = entityDefinitions.find((entity) => entity.key === 'equipment')
  if (!itemEntity || !equipmentEntity) return entities

  const itemsBucket = entities[itemEntity.id]
  const equipmentBucket = entities[equipmentEntity.id]
  if (!itemsBucket || !equipmentBucket) return entities

  const equipmentItemIds = new Set(
    itemsBucket.records
      .filter((record) => String(record.values.kind) === 'EQUIPMENT' && record.id)
      .map((record) => record.id),
  )

  const existingEquipment = new Map(equipmentBucket.records.map((record) => [record.id, record]))
  const records: EntityRecord[] = []

  equipmentItemIds.forEach((itemId) => {
    const current = existingEquipment.get(itemId)
    if (current) {
      records.push({
        ...current,
        id: itemId,
        values: {
          ...current.values,
          itemid: itemId,
        },
      })
      return
    }

    records.push({
      id: itemId,
      name: `Equipment ${itemId}`,
      values: {
        itemid: itemId,
        category: globalEnums.EquipmentCategory[0],
        assets: defaultValueByType('assets'),
        stats: defaultValueByType('stats'),
      },
    })
  })

  return {
    ...entities,
    [equipmentEntity.id]: {
      ...equipmentBucket,
      records,
      selectedId: records.some((record) => record.id === equipmentBucket.selectedId)
        ? equipmentBucket.selectedId
        : records[0]?.id ?? null,
    },
  }
}

const runtimeItemSchema = z.object({
  name: z.string().min(1),
  kind: z.string().min(1),
  stack: z.object({
    enabled: z.boolean(),
    max: z.number().int().nonnegative(),
    group: z.string(),
  }),
  assets: z.object({
    icon: z.string().optional().default(''),
    mesh: z.string().optional().default(''),
    animation: z.string().optional().default(''),
    sound: z.string().optional().default(''),
  }),
  category: z.string().optional(),
  stats: z
    .object({
      physicalDamage: z.number(),
      magicDamage: z.number(),
    })
    .optional(),
})

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
  editorJson: '',
  runtimeJson: '',
  nodePositions: {},
  relationTypes,
  enums: globalEnums,
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

  addField: (entityId, label, type, enumKey) =>
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
        enumKey: type === 'enum' ? enumKey : undefined,
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
        enumKey: patch.type === 'enum' ? patch.enumKey : undefined,
      }

      const records = bucket.records.map((record) => {
        const previousValue = record.values[currentField.key]
        const values = { ...record.values }
        delete values[currentField.key]
        values[nextKey] =
          previousValue === undefined
            ? patch.type === 'enum'
              ? ''
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
        acc[field.key] =
          field.type === 'enum'
            ? state.enums[field.enumKey ?? '']?.[0] ?? ''
            : defaultValueByType(field.type)
        return acc
      }, {})
      const entity = state.entityDefinitions.find((def) => def.id === entityId)
      const primaryKeyField = getPrimaryKeyField(entity?.key ?? '')
      const record: EntityRecord = {
        id: `draft_${entity?.key ?? 'entity'}_${state.entities[entityId].records.length + 1}`,
        name: `${entity?.label ?? 'Kayıt'} ${state.entities[entityId].records.length + 1}`,
        values: { ...values, [primaryKeyField]: '' },
      }
      const nextEntities = {
        ...state.entities,
        [entityId]: {
          ...state.entities[entityId],
          records: [...state.entities[entityId].records, record],
          selectedId: record.id,
        },
      }
      const syncedEntities = syncEquipmentWithItems(nextEntities, state.entityDefinitions)
      return {
        entities: syncedEntities,
      }
    }),

  updateRecordMeta: (entityId, recordId, patch) =>
    set((state) => {
      const bucket = state.entities[entityId]
      const entityDef = state.entityDefinitions.find((entity) => entity.id === entityId)
      const primaryKeyField = getPrimaryKeyField(entityDef?.key ?? '')
      let previousId = ''
      const records = bucket.records.map((record) => {
        if (record.id !== recordId) return record
        previousId = record.id
        const maybeName = patch.name ?? record.name
        return { ...record, name: maybeName }
      })
      const nextRecord = records.find((record) => record.id === recordId)
      const nextId = String(nextRecord?.values[primaryKeyField] ?? nextRecord?.id ?? '')

      const normalizedRecords = records.map((record) =>
        record.id === recordId ? { ...record, id: nextId || record.id } : record,
      )
      const normalizedId = nextId || recordId

      return {
        entities: syncEquipmentWithItems(
          {
            ...state.entities,
            [entityId]: { ...bucket, records: normalizedRecords, selectedId: normalizedId },
          },
          state.entityDefinitions,
        ),
        relations: state.relations.map((relation) => ({
          ...relation,
          sourceId: relation.sourceId === previousId ? normalizedId : relation.sourceId,
          targetId: relation.targetId === previousId ? normalizedId : relation.targetId,
        })),
      }
    }),

  updateRecordValue: (entityId, recordId, fieldKey, value) =>
    set((state) => {
      const bucket = state.entities[entityId]
      const entityDef = state.entityDefinitions.find((entity) => entity.id === entityId)
      const primaryKeyField = getPrimaryKeyField(entityDef?.key ?? '')
      let previousId = ''
      let nextId = ''

      const records = bucket.records.map((record) => {
        if (record.id !== recordId) return record
        previousId = record.id
        const nextValues = { ...record.values, [fieldKey]: value }
        if (fieldKey === primaryKeyField) nextId = String(value)
        return {
          ...record,
          id: fieldKey === primaryKeyField ? String(value) : record.id,
          values: nextValues,
        }
      })

      const resolvedId = nextId || recordId
      return {
        entities: syncEquipmentWithItems(
          {
            ...state.entities,
            [entityId]: {
              ...bucket,
              records,
              selectedId: bucket.selectedId === recordId ? resolvedId : bucket.selectedId,
            },
          },
          state.entityDefinitions,
        ),
        relations: state.relations.map((relation) => ({
          ...relation,
          sourceId: relation.sourceId === previousId ? resolvedId : relation.sourceId,
          targetId: relation.targetId === previousId ? resolvedId : relation.targetId,
        })),
      }
    }),

  removeRecord: (entityId, recordId) =>
    set((state) => {
      const nextEntities = {
        ...state.entities,
        [entityId]: {
          ...state.entities[entityId],
          records: state.entities[entityId].records.filter((record) => record.id !== recordId),
          selectedId: state.entities[entityId].selectedId === recordId ? null : state.entities[entityId].selectedId,
        },
      }
      return {
        entities: syncEquipmentWithItems(nextEntities, state.entityDefinitions),
        relations: state.relations.filter((relation) => relation.sourceId !== recordId && relation.targetId !== recordId),
      }
    }),

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

  buildEditorJson: () =>
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

      const editorJson = JSON.stringify(exportData, null, 2)
      return { editorJson, exportJson: editorJson }
    }),

  buildRuntimeJson: () => {
    const state = useWorldStore.getState()
    const errors: string[] = []
    const allIds = new Set<string>()

    const itemDef = state.entityDefinitions.find((entity) => entity.key === 'items')
    const equipmentDef = state.entityDefinitions.find((entity) => entity.key === 'equipment')
    const zoneDef = state.entityDefinitions.find((entity) => entity.key === 'zones')
    const items = itemDef ? state.entities[itemDef.id].records : []
    const equipment = equipmentDef ? state.entities[equipmentDef.id].records : []
    const zones = zoneDef ? state.entities[zoneDef.id].records : []
    const equipmentById = new Map(equipment.map((record) => [record.id, record]))

    ;[...items, ...zones].forEach((record) => {
      if (!record.id || record.id.startsWith('draft_')) return
      if (allIds.has(record.id)) errors.push(`Duplicate ID: ${record.id}`)
      allIds.add(record.id)
    })

    items.forEach((item) => {
      const stack = item.values.stack as NestedFieldValue | undefined
      if (stack?.enabled && (!stack.max || Number(stack.max) <= 0)) {
        errors.push(`${item.id} için stack.max zorunlu.`)
      }
    })

    if (errors.length > 0) return { ok: false, errors }

    const itemRegistry: Record<string, Record<string, unknown>> = {}
    items.forEach((item) => {
      if (!item.id || item.id.startsWith('draft_')) {
        errors.push(`Items içinde geçersiz itemid: ${item.name}`)
        return
      }
      const base = {
        name: item.name,
        kind: item.values.kind ?? 'RESOURCE',
        stack: item.values.stack ?? { enabled: false, max: 0, group: '' },
        assets: item.values.assets ?? { icon: '' },
      } as Record<string, unknown>

      const ext = equipmentById.get(item.id)
      if (ext) {
        base.category = ext.values.category ?? 'Weapon'
        base.assets = ext.values.assets ?? base.assets
        base.stats = ext.values.stats ?? { physicalDamage: 0, magicDamage: 0 }
      }
      const parsed = runtimeItemSchema.safeParse(base)
      if (!parsed.success) {
        errors.push(`${item.id} runtime şema hatası: ${parsed.error.issues[0]?.message ?? 'geçersiz alan'}`)
        return
      }
      itemRegistry[item.id] = parsed.data
    })

    if (errors.length > 0) return { ok: false, errors }

    const runtimeData = { version: '1.0.0', ItemRegistry: itemRegistry }
    const runtimeJson = JSON.stringify(runtimeData, null, 2)
    set({ runtimeJson, exportJson: runtimeJson })
    return { ok: true, errors: [] }
  },

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
        editorJson: '',
        runtimeJson: '',
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
        enums: state.enums,
      }),
    },
  ),
)
