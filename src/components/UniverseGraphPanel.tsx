import { useMemo } from 'react'
import { Background, Controls, MiniMap, ReactFlow, type Connection, type Edge, type Node } from 'reactflow'
import 'reactflow/dist/style.css'
import { useWorldStore } from '../store/useWorldStoreV2'
import { EntityNode } from './EntityNode'

const nodeTypes = {
  entityNode: EntityNode,
}

interface GraphNodeData {
  label: string
  entityLabel: string
  color: string
  icon: string
}

export function UniverseGraphPanel() {
  const entities = useWorldStore((state) => state.entities)
  const entityDefinitions = useWorldStore((state) => state.entityDefinitions)
  const nodePositions = useWorldStore((state) => state.nodePositions)
  const relations = useWorldStore((state) => state.relations)
  const onNodesChange = useWorldStore((state) => state.onNodesChange)
  const connectNodes = useWorldStore((state) => state.connectNodes)
  const setRelationType = useWorldStore((state) => state.setRelationType)
  const removeRelation = useWorldStore((state) => state.removeRelation)
  const relationTypes = useWorldStore((state) => state.relationTypes)

  const nodes = useMemo<Node<GraphNodeData>[]>(() => {
    const allNodes: Node<GraphNodeData>[] = []

    entityDefinitions.forEach((entity, entityIndex) => {
      const bucket = entities[entity.id]
      if (!bucket) return

      bucket.records.forEach((record, recordIndex) => {
        const defaultPosition = {
          x: entityIndex * 320 + 50,
          y: recordIndex * 120 + 50,
        }
        allNodes.push({
          id: record.id,
          type: 'entityNode',
          data: {
            label: record.name,
            entityLabel: entity.label,
            color: entity.color,
            icon: entity.icon,
          },
          position: nodePositions[record.id] ?? defaultPosition,
        })
      })
    })

    return allNodes
  }, [entities, entityDefinitions, nodePositions])

  const edgesFromStore = useMemo<Edge[]>(
    () =>
      relations.map((relation) => ({
        id: relation.id,
        source: relation.sourceId,
        target: relation.targetId,
        label: relation.relationType,
        animated: relation.relationType === 'spawns_in',
      })),
    [relations],
  )

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return
    connectNodes(connection.source, connection.target)
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="h-[68vh] overflow-hidden rounded-xl border border-slate-300 bg-white">
        <div className="h-full w-full">
        <ReactFlow
          className="h-full w-full"
          nodes={nodes}
          edges={edgesFromStore}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          fitView
          minZoom={0.2}
        >
          <MiniMap pannable />
          <Controls />
          <Background />
        </ReactFlow>
        </div>
      </div>

      <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">İlişkiler</h2>
        <div className="space-y-2">
          {relations.map((relation) => (
            <div key={relation.id} className="rounded-lg border border-slate-200 p-2 text-sm">
              <p className="mb-2 font-medium text-slate-700">
                {relation.sourceId} {'->'} {relation.targetId}
              </p>
              <select
                value={relation.relationType}
                onChange={(event) => setRelationType(relation.id, event.target.value)}
                className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1"
              >
                {relationTypes.map((relationType) => (
                  <option key={relationType} value={relationType}>
                    {relationType}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRelation(relation.id)}
                className="text-xs text-red-600 hover:text-red-800"
              >
                İlişkiyi Sil
              </button>
            </div>
          ))}
          {relations.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
              Grafikte node'lar arasında çizgi çekerek ilişki oluştur.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
