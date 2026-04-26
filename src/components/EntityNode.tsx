import { Handle, Position, type NodeProps } from 'reactflow'

interface EntityNodeData {
  label: string
  entityLabel: string
  color: string
  icon: string
}

export function EntityNode({ data, selected }: NodeProps<EntityNodeData>) {
  return (
    <div
      className={`min-w-[180px] rounded-xl border bg-white px-3 py-2 shadow-md ${selected ? 'ring-2 ring-blue-400' : ''}`}
      style={{ borderColor: data.color }}
    >
      <Handle type="target" position={Position.Left} style={{ background: data.color }} />
      <div className="flex items-center gap-2">
        <span className="text-lg">{data.icon}</span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{data.entityLabel}</p>
          <p className="text-sm font-semibold text-slate-800">{data.label}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: data.color }} />
    </div>
  )
}
