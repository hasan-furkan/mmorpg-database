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
  { id: 'entity_item_registry', key: 'itemRegistry', label: 'ItemRegistry', color: '#2563eb', icon: '🧰' },
  { id: 'entity_skill_registry', key: 'skillRegistry', label: 'SkillRegistry', color: '#7c3aed', icon: '✨' },
  { id: 'entity_recipe_registry', key: 'recipeRegistry', label: 'RecipeRegistry', color: '#ea580c', icon: '🧪' },
  { id: 'entity_mob_registry', key: 'mobRegistry', label: 'MobRegistry', color: '#dc2626', icon: '👾' },
  { id: 'entity_zone_registry', key: 'zoneRegistry', label: 'ZoneRegistry', color: '#16a34a', icon: '🗺️' },
  { id: 'entity_progression_registry', key: 'progressionRegistry', label: 'ProgressionRegistry', color: '#0ea5e9', icon: '📈' },
  { id: 'entity_mount_registry', key: 'mountRegistry', label: 'MountRegistry', color: '#a855f7', icon: '🐎' },
  { id: 'entity_loot_table_registry', key: 'lootTableRegistry', label: 'LootTableRegistry', color: '#d97706', icon: '🎁' },
]

const globalEnums = {
  ItemKind: ['RESOURCE', 'EQUIPMENT', 'CONSUMABLE', 'QUEST'],
  ItemCategory: ['Weapon', 'Armor', 'Tool', 'Consumable'],
  SkillType: ['ACTIVE', 'PASSIVE'],
  ZoneType: ['SAFE', 'BLACK'],
  ProgressionCategory: ['GATHERING', 'COMBAT'],
  MountType: ['STANDARD', 'PREMIUM'],
}

const defaultFields: Record<string, DynamicField[]> = {
  entity_item_registry: [
    { id: 'itemid', key: 'itemid', label: 'Item ID', type: 'string' },
    { id: 'kind', key: 'kind', label: 'Kind', type: 'enum', enumKey: 'ItemKind' },
    { id: 'category', key: 'category', label: 'Category', type: 'enum', enumKey: 'ItemCategory' },
    { id: 'stack', key: 'stack', label: 'Stack', type: 'object', objectShape: { enabled: 'boolean', max: 'number', group: 'string' } },
    { id: 'stats', key: 'stats', label: 'Stats', type: 'object', objectShape: { physicalDamage: 'number', magicDamage: 'number' } },
    { id: 'durability', key: 'durability', label: 'Durability', type: 'object', objectShape: { max: 'number', lossPerUse: 'number' } },
    { id: 'economy', key: 'economy', label: 'Economy', type: 'object', objectShape: { baseValue: 'number' } },
    { id: 'requirements', key: 'requirements', label: 'Requirements', type: 'object', objectShape: { level: 'number' } },
    { id: 'requirementSkills', key: 'requirementSkills', label: 'Requirement Skills', type: 'stringArray', addLabel: 'Skill Ekle' },
    { id: 'tags', key: 'tags', label: 'Tags', type: 'stringArray', addLabel: 'Tag Ekle' },
    { id: 'assets', key: 'assets', label: 'Assets', type: 'object', objectShape: { icon: 'string', mesh: 'string', animation: 'string', sound: 'string' } },
    { id: 'equipmentSkills', key: 'equipmentSkills', label: 'Equipment Skills', type: 'object', objectShape: { Q: 'string', W: 'string', E: 'string', R: 'string', D: 'string', F: 'string' } },
  ],
  entity_skill_registry: [
    { id: 'skillid', key: 'skillid', label: 'Skill ID', type: 'string' },
    { id: 'slot', key: 'slot', label: 'Slot', type: 'string' },
    { id: 'cooldown', key: 'cooldown', label: 'Cooldown', type: 'number' },
    { id: 'type', key: 'type', label: 'Type', type: 'enum', enumKey: 'SkillType' },
    { id: 'scaling', key: 'scaling', label: 'Scaling', type: 'object', objectShape: { physical: 'number', magic: 'number' } },
  ],
  entity_recipe_registry: [
    { id: 'recipeid', key: 'recipeid', label: 'Recipe ID', type: 'string' },
    { id: 'output', key: 'output', label: 'Output', type: 'string' },
    { id: 'amount', key: 'amount', label: 'Amount', type: 'number' },
    { id: 'craftTime', key: 'craftTime', label: 'Craft Time', type: 'number' },
    { id: 'requirementsItems', key: 'requirementsItems', label: 'Item Requirements', type: 'objectArray', addLabel: 'Item Requirement Ekle', itemShape: { itemID: 'string', amount: 'number' } },
    { id: 'requirementsSkills', key: 'requirementsSkills', label: 'Skill Requirements', type: 'objectArray', addLabel: 'Skill Requirement Ekle', itemShape: { skillID: 'string', level: 'number' } },
  ],
  entity_mob_registry: [
    { id: 'mobid', key: 'mobid', label: 'Mob ID', type: 'string' },
    { id: 'name', key: 'name', label: 'Name', type: 'string' },
    { id: 'level', key: 'level', label: 'Level', type: 'number' },
    { id: 'stats', key: 'stats', label: 'Stats', type: 'object', objectShape: { hp: 'number', damage: 'number' } },
    { id: 'drops', key: 'drops', label: 'Drops', type: 'objectArray', addLabel: 'Drop Ekle', itemShape: { itemID: 'string', chance: 'number', min: 'number', max: 'number' } },
  ],
  entity_zone_registry: [
    { id: 'zoneid', key: 'zoneid', label: 'Zone ID', type: 'string' },
    { id: 'type', key: 'type', label: 'Type', type: 'enum', enumKey: 'ZoneType' },
    { id: 'levelRange', key: 'levelRange', label: 'Level Range', type: 'numberRange' },
    { id: 'resources', key: 'resources', label: 'Resources', type: 'objectArray', addLabel: 'Resource Ekle', itemShape: { itemID: 'string', spawnChance: 'number' } },
    { id: 'mobs', key: 'mobs', label: 'Mobs', type: 'stringArray', addLabel: 'Mob Ekle' },
    { id: 'rules', key: 'rules', label: 'Rules', type: 'object', objectShape: { pvp: 'boolean', fullLoot: 'boolean' } },
  ],
  entity_progression_registry: [
    { id: 'progressionid', key: 'progressionid', label: 'Progression ID', type: 'string' },
    { id: 'category', key: 'category', label: 'Category', type: 'enum', enumKey: 'ProgressionCategory' },
    { id: 'skillName', key: 'skillName', label: 'Skill Name', type: 'string' },
    { id: 'maxLevel', key: 'maxLevel', label: 'Max Level', type: 'number' },
    { id: 'expCurveMultiplier', key: 'expCurveMultiplier', label: 'EXP Curve Multiplier', type: 'number' },
  ],
  entity_mount_registry: [
    { id: 'mountid', key: 'mountid', label: 'Mount ID', type: 'string' },
    { id: 'speed', key: 'speed', label: 'Speed', type: 'number' },
    { id: 'stamina', key: 'stamina', label: 'Stamina', type: 'number' },
    { id: 'type', key: 'type', label: 'Type', type: 'enum', enumKey: 'MountType' },
    { id: 'rules', key: 'rules', label: 'Rules', type: 'object', objectShape: { canJump: 'boolean', despawnOnHit: 'boolean' } },
  ],
  entity_loot_table_registry: [
    { id: 'lootTableId', key: 'lootTableId', label: 'LootTable ID', type: 'string' },
    { id: 'sourceName', key: 'sourceName', label: 'Source Name', type: 'string' },
    { id: 'drops', key: 'drops', label: 'Drops', type: 'objectArray', addLabel: 'Drop Ekle', itemShape: { itemID: 'string', chance: 'number' } },
  ],
}

const relationTypes = ['drops_from', 'spawns_in', 'contains', 'requires', 'crafts_into', 'related_to']
const entityColors = ['#7c3aed', '#ea580c', '#0891b2', '#be123c', '#0284c7', '#65a30d']
const entityIcons = ['📦', '🐎', '📜', '🏰', '⚗️', '🛡️']

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

function defaultValueByType(type: FieldType): FieldValue {
  if (type === 'number') return 0
  if (type === 'boolean') return false
  if (type === 'numberRange') return [1, 1]
  if (type === 'stringArray') return []
  if (type === 'objectArray') return []
  if (type === 'object') return {}
  return ''
}

function createBucket(fields: DynamicField[]): EntityBucket {
  return { fields, records: [], filter: '', selectedId: null }
}

function getPrimaryKeyField(entityKey: string): string {
  const map: Record<string, string> = {
    itemRegistry: 'itemid',
    skillRegistry: 'skillid',
    recipeRegistry: 'recipeid',
    mobRegistry: 'mobid',
    zoneRegistry: 'zoneid',
    progressionRegistry: 'progressionid',
    mountRegistry: 'mountid',
    lootTableRegistry: 'lootTableId',
  }
  return map[entityKey] ?? 'id'
}

function nextPositionsFromChanges(changes: NodeChange[], current: PositionMap): PositionMap {
  const next = { ...current }
  let changed = false
  changes.forEach((change) => {
    if (change.type === 'position' && change.position) {
      next[change.id] = change.position
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
          const entity: EntityDefinition = {
            id: id(`entity_${key}`),
            key,
            label: label.trim(),
            color: entityColors[state.entityDefinitions.length % entityColors.length],
            icon: entityIcons[state.entityDefinitions.length % entityIcons.length],
          }
          return {
            entityDefinitions: [...state.entityDefinitions, entity],
            entities: { ...state.entities, [entity.id]: createBucket([]) },
            activeEntityId: entity.id,
          }
        }),
      removeEntity: (entityId) =>
        set((state) => {
          if (state.entityDefinitions.length <= 1) return state
          const defs = state.entityDefinitions.filter((entity) => entity.id !== entityId)
          const entities = { ...state.entities }
          delete entities[entityId]
          return { entityDefinitions: defs, entities, activeEntityId: defs[0].id }
        }),
      setFilter: (entityId, filter) =>
        set((state) => ({ entities: { ...state.entities, [entityId]: { ...state.entities[entityId], filter } } })),
      selectRecord: (entityId, recordId) =>
        set((state) => ({ entities: { ...state.entities, [entityId]: { ...state.entities[entityId], selectedId: recordId } } })),
      addField: (entityId, label, type, enumKey) =>
        set((state) => {
          const key = normalizeKey(label)
          if (!key) return state
          const field: DynamicField = { id: id('field'), key, label, type, enumKey }
          return { entities: { ...state.entities, [entityId]: { ...state.entities[entityId], fields: [...state.entities[entityId].fields, field] } } }
        }),
      updateField: (entityId, fieldId, patch) =>
        set((state) => ({
          entities: {
            ...state.entities,
            [entityId]: {
              ...state.entities[entityId],
              fields: state.entities[entityId].fields.map((field) =>
                field.id === fieldId ? { ...field, label: patch.label, type: patch.type, enumKey: patch.enumKey } : field,
              ),
            },
          },
        })),
      removeField: (entityId, fieldId) =>
        set((state) => ({
          entities: {
            ...state.entities,
            [entityId]: { ...state.entities[entityId], fields: state.entities[entityId].fields.filter((field) => field.id !== fieldId) },
          },
        })),
      addRecord: (entityId) =>
        set((state) => {
          const entity = state.entityDefinitions.find((item) => item.id === entityId)
          const pk = getPrimaryKeyField(entity?.key ?? '')
          const values = state.entities[entityId].fields.reduce<Record<string, FieldValue>>((acc, field) => {
            acc[field.key] = field.type === 'enum' ? state.enums[field.enumKey ?? '']?.[0] ?? '' : defaultValueByType(field.type)
            return acc
          }, {})
          const record: EntityRecord = {
            id: `draft_${entity?.key}_${state.entities[entityId].records.length + 1}`,
            name: `${entity?.label} ${state.entities[entityId].records.length + 1}`,
            values: { ...values, [pk]: '' },
          }
          return {
            entities: {
              ...state.entities,
              [entityId]: { ...state.entities[entityId], records: [...state.entities[entityId].records, record], selectedId: record.id },
            },
          }
        }),
      updateRecordMeta: (entityId, recordId, patch) =>
        set((state) => ({
          entities: {
            ...state.entities,
            [entityId]: {
              ...state.entities[entityId],
              records: state.entities[entityId].records.map((record) => (record.id === recordId ? { ...record, ...patch } : record)),
            },
          },
        })),
      updateRecordValue: (entityId, recordId, fieldKey, value) =>
        set((state) => {
          const entity = state.entityDefinitions.find((item) => item.id === entityId)
          const pk = getPrimaryKeyField(entity?.key ?? '')
          return {
            entities: {
              ...state.entities,
              [entityId]: {
                ...state.entities[entityId],
                records: state.entities[entityId].records.map((record) =>
                  record.id === recordId
                    ? { ...record, id: fieldKey === pk ? String(value) : record.id, values: { ...record.values, [fieldKey]: value } }
                    : record,
                ),
              },
            },
          }
        }),
      removeRecord: (entityId, recordId) =>
        set((state) => ({
          entities: {
            ...state.entities,
            [entityId]: { ...state.entities[entityId], records: state.entities[entityId].records.filter((record) => record.id !== recordId) },
          },
        })),
      setRelationType: (relationId, relationType) =>
        set((state) => ({ relations: state.relations.map((relation) => (relation.id === relationId ? { ...relation, relationType } : relation)) })),
      removeRelation: (relationId) => set((state) => ({ relations: state.relations.filter((relation) => relation.id !== relationId) })),
      onNodesChange: (changes) => set((state) => ({ nodePositions: nextPositionsFromChanges(changes, state.nodePositions) })),
      connectNodes: (sourceId, targetId) =>
        set((state) => ({ relations: [...state.relations, { id: id('rel'), sourceId, targetId, relationType: 'related_to' }] })),
      buildEditorJson: () =>
        set((state) => {
          const editor = JSON.stringify({ entities: state.entityDefinitions, schemas: Object.fromEntries(state.entityDefinitions.map((d) => [d.key, state.entities[d.id].fields])), world: Object.fromEntries(state.entityDefinitions.map((d) => [d.key, state.entities[d.id].records])), relations: state.relations }, null, 2)
          return { editorJson: editor, exportJson: editor }
        }),
      buildRuntimeJson: () => {
        const state = useWorldStore.getState()
        const map: Record<string, string> = {
          itemRegistry: 'ItemRegistry',
          skillRegistry: 'SkillRegistry',
          recipeRegistry: 'RecipeRegistry',
          mobRegistry: 'MobRegistry',
          zoneRegistry: 'ZoneRegistry',
          progressionRegistry: 'ProgressionRegistry',
          mountRegistry: 'MountRegistry',
          lootTableRegistry: 'LootTableRegistry',
        }
        const root: Record<string, unknown> = { version: '2.0.0' }
        state.entityDefinitions.forEach((entity) => {
          const runtimeKey = map[entity.key]
          if (!runtimeKey) return
          root[runtimeKey] = Object.fromEntries(
            state.entities[entity.id].records.filter((record) => record.id && !record.id.startsWith('draft_')).map((record) => [record.id, { ...record.values, name: record.name }]),
          )
        })
        const runtimeJson = JSON.stringify(root, null, 2)
        set({ runtimeJson, exportJson: runtimeJson })
        return { ok: true, errors: [] }
      },
      importFromJson: () => ({ ok: false, message: 'Import bu revizyonda devre dışı bırakıldı.' }),
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
