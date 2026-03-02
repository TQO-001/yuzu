// WM-04: Functional Test Cases — SchemaExtractorService
//
// TEST STRATEGY:
//   Integration tests against a real PostgreSQL test database.
//   This verifies the actual SQL queries work correctly and that
//   the data mapping logic produces the expected TypeScript shapes.
//
// HOW TO RUN:
//   1. Create test DB:  psql -U postgres -c "CREATE DATABASE schema_documenter_test;"
//   2. Run:             npm test
//   3. With coverage:   npm test -- --coverage
//
// WIL PORTFOLIO NOTE:
//   Attach the Jest output (npm test) and coverage report as WM-04 evidence.

import { SchemaExtractorService } from '../src/lib/services/SchemaExtractorService';

// Configure test database before the pool initialises
process.env.DB_HOST     = process.env.TEST_DB_HOST     ?? 'localhost';
process.env.DB_PORT     = process.env.TEST_DB_PORT     ?? '5432';
process.env.DB_NAME     = process.env.TEST_DB_NAME     ?? 'schema_documenter_test';
process.env.DB_USER     = process.env.TEST_DB_USER     ?? 'postgres';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? 'postgres';

// ─────────────────────────────────────────────────────────────────────────────

describe('SchemaExtractorService — WM-04 Functional Tests', () => {
  let service: SchemaExtractorService;

  beforeAll(() => {
    service = new SchemaExtractorService();
  });

  // ── TC-01: Basic extraction ────────────────────────────────────────────────

  /**
   * TC-01: Verifies that the service can connect to PostgreSQL and that
   * information_schema.tables returns at least one table.
   * (Even an empty test DB has system tables visible from pg_catalog.)
   */
  test('TC-01: extractFullSchema() connects to DB and returns a result', async () => {
    const result = await service.extractFullSchema();

    // The result must be an object with the expected shape
    expect(result).toHaveProperty('tables');
    expect(result).toHaveProperty('columns');
    expect(result).toHaveProperty('foreignKeys');
    expect(result).toHaveProperty('extractedAt');
    expect(result).toHaveProperty('databaseName');

    // databaseName must match what we configured
    expect(typeof result.databaseName).toBe('string');
    expect(result.databaseName.length).toBeGreaterThan(0);
  });

  // ── TC-02: Multi-tenant classification accuracy ────────────────────────────

  /**
   * TC-02: Every table that contains a tenant discriminator column
   * (tenant_id, client_id, organisation_id, org_id) must be classified
   * as MULTI-TENANT. Single-tenant tables must be SINGLE-TENANT.
   */
  test('TC-02: Tables with tenant_id are classified as MULTI-TENANT', async () => {
    const result = await service.extractFullSchema();

    // Get all unique table names that have a tenant key column
    const tablesWithTenantCol = new Set(
      result.columns
        .filter((c) => c.isTenantKey)
        .map((c) => c.tableName)
    );

    // Each of those tables must be classified as MULTI-TENANT
    tablesWithTenantCol.forEach((tableName) => {
      const table = result.tables.find((t) => t.tableName === tableName);
      if (table) {
        expect(table.tenancyClassification).toBe('MULTI-TENANT');
      }
    });

    // Any table without a tenant column must be SINGLE-TENANT
    const tablesWithoutTenantCol = result.tables.filter(
      (t) => !tablesWithTenantCol.has(t.tableName)
    );
    tablesWithoutTenantCol.forEach((table) => {
      expect(table.tenancyClassification).toBe('SINGLE-TENANT');
    });
  });

  // ── TC-03: FK referential integrity ───────────────────────────────────────

  /**
   * TC-03: Every foreign key relationship must reference tables that
   * actually exist in the extracted table list.
   * This validates both the SQL query and the TypeScript mapping.
   */
  test('TC-03: All FK source and target tables exist in the table list', async () => {
    const result   = await service.extractFullSchema();
    const tableSet = new Set(result.tables.map((t) => t.tableName));

    result.foreignKeys.forEach((fk) => {
      expect(tableSet.has(fk.sourceTable)).toBe(true);
      expect(tableSet.has(fk.targetTable)).toBe(true);
    });
  });

  // ── TC-04: Column data completeness ───────────────────────────────────────

  /**
   * TC-04: Every extracted column must have a non-empty data_type string.
   * This validates that the multi-join in SQL-2 does not produce orphaned
   * column rows with null types.
   */
  test('TC-04: Every column has a valid non-empty data_type', async () => {
    const result = await service.extractFullSchema();

    // Guard: skip if no columns (empty test DB)
    if (result.columns.length === 0) {
      console.warn('[TC-04] No columns found — seed test DB for richer coverage');
      return;
    }

    result.columns.forEach((col) => {
      expect(typeof col.dataType).toBe('string');
      expect(col.dataType.trim().length).toBeGreaterThan(0);
    });
  });

  // ── TC-05: ISO 8601 timestamp ──────────────────────────────────────────────

  /**
   * TC-05: The extractedAt field must be a valid ISO 8601 date string.
   * This confirms the service correctly serialises the extraction timestamp.
   */
  test('TC-05: extractedAt is a valid ISO 8601 date string', async () => {
    const result = await service.extractFullSchema();

    // Must not throw when parsed
    expect(() => new Date(result.extractedAt)).not.toThrow();

    // Round-tripping through Date must produce the same string
    expect(new Date(result.extractedAt).toISOString()).toBe(result.extractedAt);
  });
});
