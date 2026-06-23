import { executePgQuery } from './connection.js';
import pino from 'pino';

const logger = pino({ name: 'init-templates' });

export async function initTemplateTables(): Promise<void> {
  logger.info('Initializing Template, Preset, and Widget tables in PostgreSQL...');

  const query = `
    CREATE TABLE IF NOT EXISTS template (
        template_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        selected_cards TEXT, 
        time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        number_of_widgets INT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS preset (
        preset_id SERIAL PRIMARY KEY,
        position INT,
        chart_type VARCHAR(100),
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        status VARCHAR(50),
        severity VARCHAR(50),
        error_code VARCHAR(50),
        vendor VARCHAR(100),
        device_type VARCHAR(50)
    );

    CREATE TABLE IF NOT EXISTS widget (
        widget_id SERIAL PRIMARY KEY,
        template_id INT NOT NULL,
        preset_id INT NOT NULL,
        time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_widget_template FOREIGN KEY (template_id) 
            REFERENCES template(template_id) ON DELETE CASCADE,
        CONSTRAINT fk_widget_preset FOREIGN KEY (preset_id) 
            REFERENCES preset(preset_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_widget_template ON widget(template_id);
    CREATE INDEX IF NOT EXISTS idx_widget_preset ON widget(preset_id);
    CREATE INDEX IF NOT EXISTS idx_preset_status ON preset(status);
    CREATE INDEX IF NOT EXISTS idx_preset_severity ON preset(severity);
    CREATE INDEX IF NOT EXISTS idx_preset_error_code ON preset(error_code);
  `;

  try {
    await executePgQuery(query);
    logger.info('PostgreSQL Template tables initialized successfully.');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize PostgreSQL Template tables.');
    throw error;
  }
}
