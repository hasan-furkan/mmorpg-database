export type FieldType = 'string' | 'number' | 'boolean' | 'image' | 'enum'

export interface DynamicField {
  id: string
  key: string
  label: string
  type: FieldType
  options?: string[]
}

export type FieldValue = string | number | boolean

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
