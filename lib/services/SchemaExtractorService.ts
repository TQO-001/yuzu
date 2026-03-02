// WM-02 + WM-03: Core service class.
//
// DESIGN DECISIONS:
//   1. Queries live here, not in route handlers — separation of concerns.
//   2. All three main queries run in parallel (Promise.all) for speed.
//   3. The class is exported as a singleton (`schemaExtractor`) so the
//      pg Pool is only used once per request, not re-created.
//   4. Raw SQL rows are mapped to typed interfaces immediately —
//      the rest of the app never sees raw pg query results.
//
// WM-02 SQL QUERIES:
//   SQL-1  information_schema.tables  + pg_stat_user_tables (row counts + size)
//   SQL-2  information_schema.columns + key_column_usage + table_constraints
//   SQL-3  table_constraints + key_column_usage + constraint_column_usage + referential_constraints
//   SQL-4  Multi-tenant classification embedded as CASE expressions in SQL-1 & SQL-2

import { db } from '@/lib/db/client';
import type {
  SchemaTable,
  SchemaColumn,
  ForeignKeyRelationship,
  SchemaExtractionResult,
} from '@/lib/types/schema.types';

export class SchemaExtractorService {

  // ─── Public Entry Point ─────────────────────────────────────────────────────

  /**
   * Runs all three extraction queries in parallel and combines the results.
   * This is the only method API routes and Server Components should call.
   */
  async extractFullSchema(): Promise<SchemaExtractionResult> {
    const [tables, columns, foreignKeys, dbNameResult] = await Promise.all([
      this.extractTables(),
      this.extractColumns(),
      this.extractForeignKeys(),
      db.query<{ current_database: string }>('SELECT current_database()'),
    ]);

    return {
      tables,
      columns,
      foreignKeys,
      extractedAt:  new Date().toISOString(),
      databaseName: dbNameResult.rows[0].current_database,
    };
  }

  // ─── SQL-1: Extract Tables ───────────────────────────────────────────────────

  /**
   * WM-02 SQL Query 1:
   *   Joins information_schema.tables with pg_stat_user_tables to get live
   *   row count estimates and pg_total_relation_size() for storage stats.
   *   A CASE subquery checks for multi-tenant discriminator columns.
   */
  private async extractTables(): Promise<SchemaTable[]> {
    const sql = `
      SELECT
          t.table_schema,
          t.table_name,
          t.table_type,

          -- Physical row count from PostgreSQL's autovacuum statistics
          COALESCE(ps.n_live_tup, 0) AS estimated_row_count,

          -- Total on-disk size including indexes and TOAST
          COALESCE(
            pg_total_relation_size(
              quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)
            ), 0
          ) AS total_size_bytes,

          -- Developer-provided table comment (COMMENT ON TABLE ...)
          obj_description(
            (quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass,
            'pg_class'
          ) AS table_comment,

          -- WM-02 SaaS Multi-tenant flag: classify table by its columns
          CASE
            WHEN EXISTS (
              SELECT 1
              FROM   information_schema.columns c2
              WHERE  c2.table_schema = t.table_schema
              AND    c2.table_name   = t.table_name
              AND    c2.column_name  IN (
                       'tenant_id', 'client_id',
                       'organisation_id', 'org_id'
                     )
            )
            THEN 'MULTI-TENANT'
            ELSE 'SINGLE-TENANT'
          END AS tenancy_classification

      FROM  information_schema.tables t
      LEFT JOIN pg_stat_user_tables ps
             ON ps.schemaname = t.table_schema
            AND ps.relname    = t.table_name
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_schema, t.table_name;
    `;

    const result = await db.query<{
      table_schema:           string;
      table_name:             string;
      table_type:             string;
      estimated_row_count:    string;   // pg returns bigint as string
      total_size_bytes:       string;   // pg returns bigint as string
      table_comment:          string | null;
      tenancy_classification: 'MULTI-TENANT' | 'SINGLE-TENANT';
    }>(sql);

    return result.rows.map((row) => ({
      tableSchema:           row.table_schema,
      tableName:             row.table_name,
      tableType:             row.table_type,
      estimatedRowCount:     parseInt(row.estimated_row_count, 10),
      totalSizeBytes:        parseInt(row.total_size_bytes, 10),
      tableComment:          row.table_comment,
      tenancyClassification: row.tenancy_classification,
    }));
  }

  // ─── SQL-2: Extract Columns ──────────────────────────────────────────────────

  /**
   * WM-02 SQL Query 2:
   *   Multi-join across 3 information_schema views to produce a complete
   *   column manifest including all constraint types (PK, FK, UNIQUE).
   *   ARRAY_AGG collects multiple constraint associations per column.
   */
  private async extractColumns(): Promise<SchemaColumn[]> {
    const sql = `
      SELECT
          c.table_schema,
          c.table_name,
          c.column_name,
          c.ordinal_position,
          c.column_default,
          c.is_nullable,
          c.data_type,
          c.character_maximum_length,
          c.numeric_precision,

          -- Aggregate all constraint types this column participates in
          -- FILTER removes the NULL introduced by the LEFT JOIN
          ARRAY_AGG(DISTINCT tc.constraint_type)
            FILTER (WHERE tc.constraint_type IS NOT NULL) AS constraint_types,

          -- WM-02 Tenant key flag
          CASE
            WHEN c.column_name IN (
              'tenant_id', 'client_id', 'organisation_id', 'org_id'
            )
            THEN true
            ELSE false
          END AS is_tenant_key

      FROM information_schema.columns c

      -- Join through key_column_usage to link columns to constraints
      LEFT JOIN information_schema.key_column_usage kcu
             ON kcu.table_schema = c.table_schema
            AND kcu.table_name   = c.table_name
            AND kcu.column_name  = c.column_name

      -- Join to table_constraints to get the constraint type label
      LEFT JOIN information_schema.table_constraints tc
             ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema    = kcu.table_schema

      WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')

      GROUP BY
          c.table_schema, c.table_name, c.column_name,
          c.ordinal_position, c.column_default, c.is_nullable,
          c.data_type, c.character_maximum_length, c.numeric_precision

      ORDER BY c.table_name, c.ordinal_position;
    `;

    const result = await db.query<{
      table_schema:              string;
      table_name:                string;
      column_name:               string;
      ordinal_position:          number;
      column_default:            string | null;
      is_nullable:               'YES' | 'NO';
      data_type:                 string;
      character_maximum_length:  number | null;
      numeric_precision:         number | null;
      constraint_types:          string[] | null;
      is_tenant_key:             boolean;
    }>(sql);

    return result.rows.map((row) => ({
      tableSchema:            row.table_schema,
      tableName:              row.table_name,
      columnName:             row.column_name,
      ordinalPosition:        row.ordinal_position,
      columnDefault:          row.column_default,
      isNullable:             row.is_nullable,
      dataType:               row.data_type,
      characterMaximumLength: row.character_maximum_length,
      numericPrecision:       row.numeric_precision,
      constraintTypes:        row.constraint_types ?? [],
      isTenantKey:            row.is_tenant_key,
    }));
  }

  // ─── SQL-3: Extract Foreign Keys ────────────────────────────────────────────

  /**
   * WM-02 SQL Query 3:
   *   Joins 4 information_schema views to extract every FK relationship
   *   as a directed edge (source → target). Each row becomes one edge
   *   in the React Flow ERD graph, with cascade rule metadata.
   */
  private async extractForeignKeys(): Promise<ForeignKeyRelationship[]> {
    const sql = `
      SELECT
          tc.table_schema         AS source_schema,
          tc.table_name           AS source_table,
          kcu.column_name         AS source_column,
          ccu.table_schema        AS target_schema,
          ccu.table_name          AS target_table,
          ccu.column_name         AS target_column,
          tc.constraint_name,
          rc.update_rule,
          rc.delete_rule

      FROM  information_schema.table_constraints AS tc

      -- Link constraint to its column(s)
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema

      -- Link constraint to the referenced (target) column
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema

      -- Get ON UPDATE / ON DELETE rules
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name   = tc.constraint_name
       AND rc.constraint_schema = tc.table_schema

      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')

      ORDER BY tc.table_name, kcu.column_name;
    `;

    const result = await db.query<{
      source_schema:   string;
      source_table:    string;
      source_column:   string;
      target_schema:   string;
      target_table:    string;
      target_column:   string;
      constraint_name: string;
      update_rule:     string;
      delete_rule:     string;
    }>(sql);

    return result.rows.map((row) => ({
      sourceSchema:   row.source_schema,
      sourceTable:    row.source_table,
      sourceColumn:   row.source_column,
      targetSchema:   row.target_schema,
      targetTable:    row.target_table,
      targetColumn:   row.target_column,
      constraintName: row.constraint_name,
      updateRule:     row.update_rule,
      deleteRule:     row.delete_rule,
    }));
  }
}

// Export a singleton so the Pool is shared across requests
export const schemaExtractor = new SchemaExtractorService();
