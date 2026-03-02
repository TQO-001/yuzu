// WM-03: Dashboard page — Next.js 15 Server Component.
//
// WHY A SERVER COMPONENT?
//   The schema extraction runs directly on the server — no API round-trip
//   needed when the page first loads. This means the ERD data is already
//   embedded in the HTML sent to the browser (faster Time-to-Interactive).
//
// The page fetches the schema, then hands it to the Client Components
// (ERDCanvas, ExportToolbar) which add interactivity.

import { schemaExtractor } from '@/lib/services/SchemaExtractorService';
import ERDCanvas           from '@/components/erd/ERDCanvas';
import ExportToolbar       from '@/components/erd/ExportToolbar';

export const dynamic = 'force-dynamic'; // Always fresh data

export default async function DashboardPage() {
  let schema;
  let errorMessage: string | null = null;

  try {
    schema = await schemaExtractor.extractFullSchema();
  } catch (error) {
    errorMessage = String(error);
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (errorMessage || !schema) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="max-w-lg w-full p-8 rounded-xl border border-red-200 bg-red-50 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold text-red-700 mb-2">Database Connection Failed</h2>
          <p className="text-sm text-red-600 font-mono break-all">{errorMessage}</p>
          <p className="mt-4 text-xs text-slate-500">
            Check your <code className="bg-slate-200 px-1 rounded">.env.local</code> DB_ variables and ensure PostgreSQL is running.
          </p>
        </div>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-slate-100">

      {/* Top navigation bar */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🗺️</span>
          <div>
            <h1 className="text-sm font-bold text-slate-800">Schema Documenter</h1>
            <p className="text-xs text-slate-500">
              Database:{' '}
              <span className="font-mono font-semibold text-violet-700">
                {schema.databaseName}
              </span>
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-violet-600 inline-block" />
            Multi-tenant table
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-400 inline-block" />
            Single-tenant table
          </span>
        </div>
      </header>

      {/* Export toolbar */}
      <ExportToolbar />

      {/* ERD canvas fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <ERDCanvas schema={schema} />
      </div>

    </div>
  );
}
