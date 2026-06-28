import pg from 'pg';
import { pgPool } from '../database/postgres/connection.js';
import { TemplateRepository } from '../repositories/template.repository.js';
import { PresetRepository } from '../repositories/preset.repository.js';
import { WidgetRepository } from '../repositories/widget.repository.js';
import { TemplateService } from '../services/template.service.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  getTemplatesQuerySchema,
  getTemplateParamsSchema,
} from '../validators/template.validator.js';

// Mock the postgres connection pool
jest.mock('../database/postgres/connection.js', () => {
  const mClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    pgPool: {
      connect: jest.fn(() => Promise.resolve(mClient)),
      query: jest.fn(),
    },
  };
});

describe('Dashboard Template System Tests', () => {
  describe('Zod Validation Schemas', () => {
    it('should validate valid createTemplate payload', () => {
      const payload = {
        name: 'Standard NOC Dashboard',
        selected_cards: '["totalAlarms", "criticalAlarms"]',
        widgets: [
          {
            position: 1,
            chart_type: 'line',
            metric: 'count',
            group_by: 'severity',
            heatmap_mode: 'weekday',
            start_date: '2026-06-01T00:00:00Z',
            end_date: '2026-06-30T00:00:00Z',
          },
        ],
      };

      const result = createTemplateSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.widgets[0].heatmap_mode).toBe('weekday');
        expect(result.data.widgets[0].start_date).toBe('2026-06-01T00:00:00Z');
      }
    });

    it('should reject createTemplate payload with missing required name', () => {
      const payload = {
        widgets: [],
      };
      const result = createTemplateSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject widget payload missing required chart_type', () => {
      const payload = {
        name: 'Bad Widget',
        widgets: [{ position: 1 }],
      };
      const result = createTemplateSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should allow empty widgets array in createTemplate', () => {
      const payload = {
        name: 'Empty Layout',
      };
      const result = createTemplateSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.widgets).toEqual([]);
      }
    });

    it('should validate valid updateTemplate payload', () => {
      const payload = {
        name: 'New Name Only',
      };
      const result = updateTemplateSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should validate templates query schema defaults', () => {
      const parsed = getTemplatesQuerySchema.parse({});
      expect(parsed.limit).toBe(20);
      expect(parsed.offset).toBe(0);
    });

    it('should limit pagination size to maximum 1000', () => {
      const result = getTemplatesQuerySchema.safeParse({ limit: 1001 });
      expect(result.success).toBe(false);
    });

    it('should validate template ID path params', () => {
      expect(getTemplateParamsSchema.parse({ id: '42' }).id).toBe(42);
      expect(getTemplateParamsSchema.safeParse({ id: 'not-a-number' }).success).toBe(false);
      expect(getTemplateParamsSchema.safeParse({ id: '0' }).success).toBe(false);
    });
  });

  describe('TemplateService Transaction Management', () => {
    let mockClient: any;
    let templateRepo: jest.Mocked<TemplateRepository>;
    let presetRepo: jest.Mocked<PresetRepository>;
    let widgetRepo: jest.Mocked<WidgetRepository>;
    let service: TemplateService;

    beforeEach(() => {
      jest.clearAllMocks();
      mockClient = {
        query: jest.fn(),
        release: jest.fn(),
      };
      (pgPool.connect as jest.Mock).mockResolvedValue(mockClient);

      templateRepo = {
        createTemplate: jest.fn(),
        getTemplateById: jest.fn(),
        listTemplates: jest.fn(),
        updateTemplate: jest.fn(),
        deleteTemplate: jest.fn(),
      } as unknown as jest.Mocked<TemplateRepository>;

      presetRepo = {
        createPreset: jest.fn(),
        getPresetById: jest.fn(),
        findUsedPresetsByIds: jest.fn(),
        deletePresetsByIds: jest.fn(),
      } as unknown as jest.Mocked<PresetRepository>;

      widgetRepo = {
        createWidget: jest.fn(),
        deleteWidgetsByTemplateId: jest.fn(),
        getWidgetsWithPresetsByTemplateId: jest.fn(),
      } as unknown as jest.Mocked<WidgetRepository>;

      service = new TemplateService(templateRepo, presetRepo, widgetRepo);
    });

    it('should execute atomic transaction for template creation', async () => {
      const name = 'New Template';
      const selectedCards = '[]';
      const widgets = [
        {
          position: 1,
          chart_type: 'line',
          metric: 'count',
          group_by: null,
          time_bucket: null,
          heatmap_mode: 'weekday',
          table_columns: null,
          start_date: '2026-06-01T00:00:00Z',
          end_date: '2026-06-30T00:00:00Z',
        },
      ];

      templateRepo.createTemplate.mockResolvedValue({
        template_id: 10,
        name,
        selected_cards: selectedCards,
        number_of_widgets: 1,
        time_created: new Date(),
        time_updated: new Date(),
      });

      presetRepo.createPreset.mockResolvedValue({
        preset_id: 42,
        preset_name: 'Line preset',
        chart_type: 'line',
        metric: 'count',
        group_by: null,
        time_bucket: null,
        heatmap_mode: 'weekday',
        table_columns: null,
      });

      const result = await service.createTemplate(name, selectedCards, widgets);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(templateRepo.createTemplate).toHaveBeenCalledWith(name, selectedCards, 1, mockClient);
      expect(presetRepo.createPreset).toHaveBeenCalledWith(
        expect.objectContaining({ chart_type: 'line', heatmap_mode: null, table_columns: null }),
        mockClient,
      );
      expect(widgetRepo.createWidget).toHaveBeenCalledWith(
        10,
        42,
        1,
        '2026-06-01T00:00:00Z',
        '2026-06-30T00:00:00Z',
        mockClient,
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result.template_id).toBe(10);
    });

    it('should rollback transaction and throw if creation fails', async () => {
      const name = 'Failing Template';
      const selectedCards = '[]';
      const widgets = [
        {
          position: 1,
          chart_type: 'line',
          metric: 'count',
          group_by: null,
          time_bucket: null,
          heatmap_mode: null,
          table_columns: null,
          start_date: null,
          end_date: null,
        },
      ];

      templateRepo.createTemplate.mockRejectedValue(new Error('DB Fail'));

      await expect(service.createTemplate(name, selectedCards, widgets)).rejects.toThrow('DB Fail');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should get detailed template by ID with its widgets and presets', async () => {
      const templateData = {
        template_id: 1,
        name: 'Template 1',
        selected_cards: '[]',
        number_of_widgets: 1,
        time_created: new Date(),
        time_updated: new Date(),
      };
      templateRepo.getTemplateById.mockResolvedValue(templateData);

      const widgetData = [
        {
          widget_id: 101,
          template_id: 1,
          preset_id: 42,
          position: 1,
          start_date: null,
          end_date: null,
          time_created: new Date(),
          time_updated: new Date(),
          preset: {
            preset_id: 42,
            preset_name: 'Cisco line',
            chart_type: 'line',
            metric: 'count',
            group_by: 'severity',
            time_bucket: null,
            heatmap_mode: 'weekday',
            table_columns: null,
          },
        },
      ];
      widgetRepo.getWidgetsWithPresetsByTemplateId.mockResolvedValue(widgetData);

      const result = await service.getTemplateById(1);

      expect(templateRepo.getTemplateById).toHaveBeenCalledWith(1);
      expect(widgetRepo.getWidgetsWithPresetsByTemplateId).toHaveBeenCalledWith(1);
      expect(result).not.toBeNull();
      expect(result!.widgets.length).toBe(1);
      expect(result!.widgets[0].preset.heatmap_mode).toBe('weekday');
      expect(result!.widgets[0].preset_id).toBe(42);
    });

    it('should return null if template by ID is not found', async () => {
      templateRepo.getTemplateById.mockResolvedValue(null);
      const result = await service.getTemplateById(999);
      expect(result).toBeNull();
    });

    it('should update template details and synchronize widgets in transaction', async () => {
      const originalTemplate = {
        template_id: 1,
        name: 'Old Name',
        selected_cards: '[]',
        number_of_widgets: 0,
        time_created: new Date(),
        time_updated: new Date(),
      };
      templateRepo.getTemplateById.mockResolvedValue(originalTemplate);

      templateRepo.updateTemplate.mockResolvedValue({
        ...originalTemplate,
        name: 'New Name',
        number_of_widgets: 1,
      });

      presetRepo.createPreset.mockResolvedValue({
        preset_id: 45,
        preset_name: 'Huawei bar',
        chart_type: 'bar',
        metric: 'count',
        group_by: 'severity',
        time_bucket: null,
        heatmap_mode: null,
        table_columns: null,
      });

      const widgets = [
        {
          position: 2,
          chart_type: 'bar',
          metric: 'count',
          group_by: 'severity',
          time_bucket: null,
          heatmap_mode: null,
          table_columns: null,
          start_date: '2026-06-01T00:00:00Z',
          end_date: '2026-06-30T00:00:00Z',
        },
      ];

      const result = await service.updateTemplate(1, 'New Name', undefined, widgets);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(widgetRepo.deleteWidgetsByTemplateId).toHaveBeenCalledWith(1, mockClient);
      expect(presetRepo.deletePresetsByIds).not.toHaveBeenCalled();
      expect(presetRepo.createPreset).toHaveBeenCalledWith(
        expect.objectContaining({
          chart_type: 'bar',
          group_by: 'severity',
          time_bucket: null,
          heatmap_mode: null,
          table_columns: null,
        }),
        mockClient,
      );
      expect(widgetRepo.createWidget).toHaveBeenCalledWith(
        1,
        45,
        2,
        '2026-06-01T00:00:00Z',
        '2026-06-30T00:00:00Z',
        mockClient,
      );
      expect(templateRepo.updateTemplate).toHaveBeenCalledWith(
        1,
        { name: 'New Name', number_of_widgets: 1 },
        mockClient,
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result!.name).toBe('New Name');
    });

    it('should set number_of_widgets to zero when all widgets are hidden in the saved UI state', async () => {
      const originalTemplate = {
        template_id: 1,
        name: 'Dashboard',
        selected_cards: '{}',
        number_of_widgets: 2,
        time_created: new Date(),
        time_updated: new Date(),
      };
      templateRepo.getTemplateById.mockResolvedValue(originalTemplate);
      templateRepo.updateTemplate.mockResolvedValue({
        ...originalTemplate,
        number_of_widgets: 0,
      });

      await service.updateTemplate(1, undefined, '{"widgets":[]}', []);

      expect(widgetRepo.deleteWidgetsByTemplateId).toHaveBeenCalledWith(1, mockClient);
      expect(presetRepo.deletePresetsByIds).not.toHaveBeenCalled();
      expect(presetRepo.createPreset).not.toHaveBeenCalled();
      expect(widgetRepo.createWidget).not.toHaveBeenCalled();
      expect(templateRepo.updateTemplate).toHaveBeenCalledWith(
        1,
        { selected_cards: '{"widgets":[]}', number_of_widgets: 0 },
        mockClient,
      );
    });

    it('should return null when updating a non-existent template', async () => {
      templateRepo.getTemplateById.mockResolvedValue(null);

      const result = await service.updateTemplate(999, 'Non-existent');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should delete template and leave reusable presets intact', async () => {
      templateRepo.deleteTemplate.mockResolvedValue(true);

      const result = await service.deleteTemplate(1);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(presetRepo.deletePresetsByIds).not.toHaveBeenCalled();
      expect(templateRepo.deleteTemplate).toHaveBeenCalledWith(1, mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
