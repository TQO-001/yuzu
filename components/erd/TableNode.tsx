// WM-03: Custom React Flow node that renders a single database table.
//
// Each node shows:
//  - Table name (with a Multi-Tenant badge if applicable)
//  - All columns with their data types, nullable flag, and constraint icons
//  - React Flow Handle anchors for FK edge connections
//
// The node is memoized with React.memo to prevent unnecessary re-renders
// when the parent canvas re-renders.

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SchemaColumn } from '@/lib/types/schema.types';

interface TableNodeData {
  tableName:             string;
  columns:               SchemaColumn[];
  tenancyClassification: 'MULTI-TENANT' | 'SINGLE-TENANT';
}

function TableNode({ data }: NodeProps) {
  const nodeData      = data as TableNodeData;
  const isMultiTenant = nodeData.tenancyClassification === 'MULTI-TENANT';

  return (
    <div
      className={`
        min-w-[220px] max-w-[280px] rounded-lg shadow-lg border-2 bg-white
        ${isMultiTenant ? 'border-violet-500' : 'border-slate-300'}
      `}
    >
      {/* ── Table Header ── */}
      <div
        className={`
          px-3 py-2 rounded-t-md text-white text-xs font-bold
          flex items-center gap-2
          ${isMultiTenant ? 'bg-violet-700' : 'bg-slate-700'}
        `}
      >
        <span className="truncate flex-1">{nodeData.tableName}</span>
        {isMultiTenant && (
          <span className="shrink-0 text-[10px] bg-violet-400 px-1.5 py-0.5 rounded-full">
            MT
          </span>
        )}
      </div>

      {/* ── Column Rows ── */}
      <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
        {nodeData.columns.map((col) => (
          <div
            key={col.columnName}
            className={`
              px-3 py-1.5 flex items-center justify-between gap-2 text-[11px]
              ${col.isTenantKey ? 'bg-violet-50' : ''}
            `}
          >
            {/* Left: icons + column name */}
            <div className="flex items-center gap-1 min-w-0">
              {col.constraintTypes.includes('PRIMARY KEY') && (
                <span title="Primary Key" className="text-amber-500 shrink-0">🔑</span>
              )}
              {col.constraintTypes.includes('FOREIGN KEY') && (
                <span title="Foreign Key" className="text-blue-400 shrink-0">🔗</span>
              )}
              {col.isTenantKey && (
                <span title="Tenant Discriminator" className="text-violet-500 shrink-0">🏢</span>
              )}
              <span className="truncate font-mono text-slate-700">
                {col.columnName}
              </span>
            </div>

            {/* Right: data type */}
            <span className="shrink-0 text-slate-400 font-mono">
              {col.dataType}
              {col.isNullable === 'YES' ? '?' : ''}
            </span>
          </div>
        ))}
      </div>

      {/* React Flow connection handles (invisible anchor points) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-white"
      />
    </div>
  );
}

export default memo(TableNode);
