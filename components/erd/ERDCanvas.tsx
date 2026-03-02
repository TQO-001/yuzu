'use client';

// WM-03: Interactive ERD canvas powered by React Flow (@xyflow/react).
//
// LAYOUT STRATEGY:
//   Tables are arranged in a simple grid (4 columns). For schemas with
//   many tables, this can be upgraded to ELK.js auto-layout by replacing
//   the buildInitialLayout function.
//
// EDGES:
//   Each ForeignKeyRelationship becomes one directed smooth-step edge.
//   source = the table that owns the FK column
//   target = the table being referenced

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TableNode from './TableNode';
import type { SchemaExtractionResult } from '@/lib/types/schema.types';

interface ERDCanvasProps {
  schema: SchemaExtractionResult;
}

// Register the custom node type
const NODE_TYPES = { tableNode: TableNode };

function buildInitialLayout(schema: SchemaExtractionResult): {
  nodes: Node[];
  edges: Edge[];
} {
  const COLS       = 4;
  const COL_WIDTH  = 300;
  const ROW_HEIGHT = 400;

  // Group columns by table name for easy lookup
  const columnsByTable = schema.columns.reduce<
    Record<string, typeof schema.columns>
  >((acc, col) => {
    (acc[col.tableName] ??= []).push(col);
    return acc;
  }, {});

  const nodes: Node[] = schema.tables.map((table, index) => ({
    id:   table.tableName,
    type: 'tableNode',
    position: {
      x: (index % COLS) * COL_WIDTH,
      y: Math.floor(index / COLS) * ROW_HEIGHT,
    },
    data: {
      tableName:             table.tableName,
      columns:               columnsByTable[table.tableName] ?? [],
      tenancyClassification: table.tenancyClassification,
    },
  }));

  const edges: Edge[] = schema.foreignKeys.map((fk) => ({
    id:           fk.constraintName,
    source:       fk.sourceTable,
    target:       fk.targetTable,
    label:        `${fk.sourceColumn} → ${fk.targetColumn}`,
    type:         'smoothstep',
    animated:     false,
    style:        { stroke: '#94a3b8', strokeWidth: 1.5 },
    labelStyle:   { fontSize: 9, fill: '#64748b' },
    labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.85 },
  }));

  return { nodes, edges };
}

export default function ERDCanvas({ schema }: ERDCanvasProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildInitialLayout(schema),
    [schema]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const multiTenantCount = schema.tables.filter(
    (t) => t.tenancyClassification === 'MULTI-TENANT'
  ).length;

  return (
    <div className="w-full h-full flex flex-col">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 shrink-0">
        <span>📦 <strong>{schema.tables.length}</strong> tables</span>
        <span>🔗 <strong>{schema.foreignKeys.length}</strong> relationships</span>
        <span>🏢 <strong>{multiTenantCount}</strong> multi-tenant</span>
        <span className="ml-auto text-slate-400">
          Extracted: {new Date(schema.extractedAt).toLocaleString()}
        </span>
      </div>

      {/* React Flow canvas */}
      <div className="flex-1" id="erd-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.05}
          maxZoom={2}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={20} color="#e2e8f0" />
          <Controls />
          <MiniMap
            nodeColor={(n) =>
              (n.data as { tenancyClassification: string })
                .tenancyClassification === 'MULTI-TENANT'
                ? '#7c3aed'
                : '#94a3b8'
            }
            pannable
            zoomable
          />
        </ReactFlow>
      </div>
    </div>
  );
}
