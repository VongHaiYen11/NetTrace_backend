import { executePgQuery } from '../database/postgres/connection.js';

export interface ErrorMetadata {
  error_code: string;
  name: string;
  description: string | null;
  domain: string | null;
  default_severity: string | null;
}

export class ErrorRepository {
  /**
   * Fetches metadata for a list of error codes from PostgreSQL.
   */
  async getErrorsByCodes(
    codes: string[],
  ): Promise<{ errors: ErrorMetadata[]; durationMs: number }> {
    if (codes.length === 0) {
      return { errors: [], durationMs: 0 };
    }

    const query = `
      SELECT 
        error_code,
        name,
        description,
        domain,
        default_severity
      FROM error
      WHERE LOWER(error_code) = ANY($1)
    `;

    const { rows, durationMs } = await executePgQuery<ErrorMetadata>(query, [
      codes.map((c) => c.toLowerCase()),
    ]);
    return { errors: rows, durationMs };
  }

  /**
   * Fetches all error definitions.
   */
  async getAllErrors(): Promise<{ errors: ErrorMetadata[]; durationMs: number }> {
    const query = `
      SELECT 
        error_code,
        name,
        description,
        domain,
        default_severity
      FROM error
    `;
    const { rows, durationMs } = await executePgQuery<ErrorMetadata>(query);
    return { errors: rows, durationMs };
  }
}
