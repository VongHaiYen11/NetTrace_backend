import { executePgQuery } from './connection.js';
import pino from 'pino';

const logger = pino({ name: 'init-templates' });

export async function initTemplateTables(): Promise<void> {
  logger.info('Initializing Template, Preset, and Widget tables in PostgreSQL...');

  const query = `
    CREATE TABLE IF NOT EXISTS Template (
        template_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        selected_cards TEXT, 
        time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        number_of_widgets INT
    );

    CREATE TABLE IF NOT EXISTS Preset (
        device_id VARCHAR(20) PRIMARY KEY,
        position INT,
        chart_type VARCHAR(100),
        status VARCHAR(50),
        severity VARCHAR(50),
        error_code VARCHAR(50),
        vendor_id VARCHAR(20),
        device_type VARCHAR(50), 
        CONSTRAINT fk_preset_device FOREIGN KEY (device_id) 
            REFERENCES device(device_id) ON DELETE CASCADE,
        CONSTRAINT fk_preset_error FOREIGN KEY (error_code) 
            REFERENCES error(error_code) ON DELETE SET NULL,
        CONSTRAINT fk_preset_vendor FOREIGN KEY (vendor_id) 
            REFERENCES vendor(vendor_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS Widget (
        widget_id SERIAL PRIMARY KEY,
        template_id INT NOT NULL,
        device_id VARCHAR(20) NOT NULL,
        time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_widget_template FOREIGN KEY (template_id) 
            REFERENCES Template(template_id) ON DELETE CASCADE,
        CONSTRAINT fk_widget_preset FOREIGN KEY (device_id) 
            REFERENCES Preset(device_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_preset_error ON Preset(error_code);
    CREATE INDEX IF NOT EXISTS idx_preset_vendor ON Preset(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_widget_template ON Widget(template_id);
    CREATE INDEX IF NOT EXISTS idx_widget_device ON Widget(device_id);
  `;

  try {
    await executePgQuery(query);
    logger.info('PostgreSQL Template tables initialized successfully.');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize PostgreSQL Template tables.');
    throw error;
  }
}
