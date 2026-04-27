export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'image'
  | 'enum'
  | 'object'
  | 'stringArray'
  | 'objectArray'
  | 'numberRange'

export interface DynamicField {
  id: string
  key: string
  label: string
  type: FieldType
  enumKey?: string
  objectShape?: Record<string, 'string' | 'number' | 'boolean'>
  itemShape?: Record<string, 'string' | 'number' | 'boolean'>
  addLabel?: string
}

export type PrimitiveValue = string | number | boolean
export type ObjectValue = Record<string, PrimitiveValue | PrimitiveValue[]>
export type ObjectArrayValue = Array<Record<string, PrimitiveValue>>
export type FieldValue = PrimitiveValue | PrimitiveValue[] | ObjectValue | ObjectArrayValue | [number, number]

export interface EntityRecord {
  id: string
  name: string
  values: Record<string, FieldValue>
}

export interface EntityDefinition {
  id: string
  key: string
  label: string
  color: string
  icon: string
}

export interface Relation {
  id: string
  sourceId: string
  targetId: string
  relationType: string
}
