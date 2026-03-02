// WM-03: Centralised type definitions.
// All data structures that flow between the database, service layer,
// API routes, and frontend components are defined here as a single
// source of truth. Changes in the DB schema only need updating here.

// ─── Table ────────────────────────────────────────────────────────────────────

export interface SchemaTable {
  tableSchema: string;
  tableName: string;
  tableType: string;
  estimatedRowCount: number;
  totalSizeBytes: number;
  tableComment: string | null;
  /** SaaS logic: 'MULTI-TENANT' if table has tenant_id/client_id/organisation_id */
  tenancyClassification: 'MULTI-TENANT' | 'SINGLE-TENANT';
}

// ─── Column ───────────────────────────────────────────────────────────────────

export interface SchemaColumn {
  tableSchema: string;
  tableName: string;
  columnName: string;
  ordinalPosition: number;
  columnDefault: string | null;
  isNullable: 'YES' | 'NO';
  dataType: string;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  /** e.g. ['PRIMARY KEY'], ['FOREIGN KEY'], ['PRIMARY KEY', 'UNIQUE'], [] */
  constraintTypes: string[];
  /** True if this column is a multi-tenant discriminator */
  isTenantKey: boolean;
}

// ─── Foreign Key ──────────────────────────────────────────────────────────────

export interface ForeignKeyRelationship {
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
  constraintName: string;
  updateRule: string;
  deleteRule: string;
}

// ─── Top-level result ─────────────────────────────────────────────────────────

export interface SchemaExtractionResult {
  tables: SchemaTable[];
  columns: SchemaColumn[];
  foreignKeys: ForeignKeyRelationship[];
  /** ISO 8601 timestamp of when the extraction ran */
  extractedAt: string;
  databaseName: string;
}
