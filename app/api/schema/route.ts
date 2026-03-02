// WM-03: GET /api/schema
//
// Thin route handler — all business logic lives in SchemaExtractorService.
// This follows the Single Responsibility Principle: routes handle HTTP,
// services handle business logic.

import { NextResponse } from 'next/server';
import { schemaExtractor } from '@/lib/services/SchemaExtractorService';

export const dynamic = 'force-dynamic'; // Never cache — schema changes in real-time

export async function GET(): Promise<NextResponse> {
  try {
    const schema = await schemaExtractor.extractFullSchema();
    return NextResponse.json(schema);
  } catch (error) {
    console.error('[API /schema] Extraction failed:', error);
    return NextResponse.json(
      { error: 'Schema extraction failed', details: String(error) },
      { status: 500 }
    );
  }
}
