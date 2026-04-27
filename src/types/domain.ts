export type FieldType = 'string' | 'number' | 'boolean' | 'image' | 'enum' | 'stack' | 'assets' | 'stats'

export interface DynamicField {
  id: string
  key: string
  label: string
  type: FieldType
  enumKey?: string
}

export type NestedFieldValue = Record<string, string | number | boolean>
export type FieldValue = string | number | boolean | NestedFieldValue

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
