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
        preset_name VARCHAR(255),
        chart_type VARCHAR(100),
        metric VARCHAR(50),
        group_by VARCHAR(50),
        time_bucket VARCHAR(50),
        heatmap_mode VARCHAR(100),
        table_columns VARCHAR(500)
    );

    ALTER TABLE preset
        ADD COLUMN IF NOT EXISTS preset_name VARCHAR(255);

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'status')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'metric') THEN
        ALTER TABLE preset RENAME COLUMN status TO metric;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'severity')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'group_by') THEN
        ALTER TABLE preset RENAME COLUMN severity TO group_by;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'error_code')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'time_bucket') THEN
        ALTER TABLE preset RENAME COLUMN error_code TO time_bucket;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'vendor')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'heatmap_mode') THEN
        ALTER TABLE preset RENAME COLUMN vendor TO heatmap_mode;
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'device_type')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'table_columns') THEN
        ALTER TABLE preset RENAME COLUMN device_type TO table_columns;
      END IF;
    END $$;

    ALTER TABLE preset
        ADD COLUMN IF NOT EXISTS metric VARCHAR(50),
        ADD COLUMN IF NOT EXISTS group_by VARCHAR(50),
        ADD COLUMN IF NOT EXISTS time_bucket VARCHAR(50),
        ADD COLUMN IF NOT EXISTS heatmap_mode VARCHAR(100),
        ADD COLUMN IF NOT EXISTS table_columns VARCHAR(500);

    CREATE TABLE IF NOT EXISTS widget (
        widget_id SERIAL PRIMARY KEY,
        template_id INT NOT NULL,
        preset_id INT NOT NULL,
        position INT NOT NULL DEFAULT 0,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        time_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_widget_template FOREIGN KEY (template_id) 
            REFERENCES template(template_id) ON DELETE CASCADE,
        CONSTRAINT fk_widget_preset FOREIGN KEY (preset_id) 
            REFERENCES preset(preset_id) ON DELETE CASCADE
    );

    ALTER TABLE widget
        ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS start_date TIMESTAMP,
        ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'position') THEN
        EXECUTE 'UPDATE widget w
                 SET position = p.position
                 FROM preset p
                 WHERE w.preset_id = p.preset_id
                   AND w.position = 0';
      END IF;
    END $$;

    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'start_date') THEN
        EXECUTE 'UPDATE widget w
                 SET start_date = COALESCE(w.start_date, p.start_date)
                 FROM preset p
                 WHERE w.preset_id = p.preset_id';
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'preset' AND column_name = 'end_date') THEN
        EXECUTE 'UPDATE widget w
                 SET end_date = COALESCE(w.end_date, p.end_date)
                 FROM preset p
                 WHERE w.preset_id = p.preset_id';
      END IF;
    END $$;

    ALTER TABLE preset
        DROP COLUMN IF EXISTS start_date,
        DROP COLUMN IF EXISTS end_date;

    CREATE INDEX IF NOT EXISTS idx_widget_template ON widget(template_id);
    CREATE INDEX IF NOT EXISTS idx_widget_preset ON widget(preset_id);
    CREATE INDEX IF NOT EXISTS idx_widget_position ON widget(position);
    CREATE INDEX IF NOT EXISTS idx_preset_metric ON preset(metric);
    CREATE INDEX IF NOT EXISTS idx_preset_group_by ON preset(group_by);
    CREATE INDEX IF NOT EXISTS idx_preset_time_bucket ON preset(time_bucket);
  `;

  try {
    await executePgQuery(query);
    logger.info('PostgreSQL Template tables initialized successfully.');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize PostgreSQL Template tables.');
    throw error;
  }
}
