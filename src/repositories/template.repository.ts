import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';

export interface Template {
  template_id: number;
  name: string;
  selected_cards: string | null;
  time_created: Date;
  time_updated: Date;
  number_of_widgets: number;
}

export class TemplateRepository {
  private getQueryExecutor(client?: pg.PoolClient) {
    return client || pgPool;
  }

  async createTemplate(
    name: string,
    selectedCards: string | null,
    numberOfWidgets: number,
    client?: pg.PoolClient,
  ): Promise<Template> {
    const executor = this.getQueryExecutor(client);
    const query = `
      INSERT INTO Template (name, selected_cards, number_of_widgets)
      VALUES ($1, $2, $3)
      RETURNING template_id, name, selected_cards, time_created, time_updated, number_of_widgets
    `;
    const res = await executor.query(query, [name, selectedCards, numberOfWidgets]);
    return res.rows[0];
  }

  async getTemplateById(id: number, client?: pg.PoolClient): Promise<Template | null> {
    const executor = this.getQueryExecutor(client);
    const query = `
      SELECT template_id, name, selected_cards, time_created, time_updated, number_of_widgets
      FROM Template
      WHERE template_id = $1
    `;
    const res = await executor.query(query, [id]);
    return res.rows[0] || null;
  }

  async listTemplates(limit: number, offset: number): Promise<Template[]> {
    const query = `
      SELECT template_id, name, selected_cards, time_created, time_updated, number_of_widgets
      FROM Template
      ORDER BY template_id DESC
      LIMIT $1 OFFSET $2
    `;
    const res = await pgPool.query(query, [limit, offset]);
    return res.rows;
  }

  async updateTemplate(
    id: number,
    fields: { name?: string; selected_cards?: string | null; number_of_widgets?: number },
    client?: pg.PoolClient,
  ): Promise<Template | null> {
    const executor = this.getQueryExecutor(client);
    const updates: string[] = [];
    const values: unknown[] = [];
    let valIdx = 1;

    if (fields.name !== undefined) {
      updates.push(`name = $${valIdx++}`);
      values.push(fields.name);
    }
    if (fields.selected_cards !== undefined) {
      updates.push(`selected_cards = $${valIdx++}`);
      values.push(fields.selected_cards);
    }
    if (fields.number_of_widgets !== undefined) {
      updates.push(`number_of_widgets = $${valIdx++}`);
      values.push(fields.number_of_widgets);
    }

    if (updates.length === 0) {
      return this.getTemplateById(id, client);
    }

    updates.push(`time_updated = CURRENT_TIMESTAMP`);

    values.push(id);
    const query = `
      UPDATE Template
      SET ${updates.join(', ')}
      WHERE template_id = $${valIdx}
      RETURNING template_id, name, selected_cards, time_created, time_updated, number_of_widgets
    `;
    const res = await executor.query(query, values);
    return res.rows[0] || null;
  }

  async deleteTemplate(id: number, client?: pg.PoolClient): Promise<boolean> {
    const executor = this.getQueryExecutor(client);
    const query = `
      DELETE FROM Template
      WHERE template_id = $1
    `;
    const res = await executor.query(query, [id]);
    return (res.rowCount ?? 0) > 0;
  }
}
