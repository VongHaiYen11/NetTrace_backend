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
            device_id: 'DEV001',
            position: 1,
            chart_type: 'line',
            status: 'active',
            severity: 'critical',
          },
        ],
      };

      const result = createTemplateSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.widgets[0].device_id).toBe('DEV001');
      }
    });

    it('should reject createTemplate payload with missing required name', () => {
      const payload = {
        widgets: [],
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
        upsertPreset: jest.fn(),
        getPresetByDeviceId: jest.fn(),
        deletePresetsByDeviceIds: jest.fn(),
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
          device_id: 'DEV001',
          position: 1,
          chart_type: 'line',
          status: 'active',
          severity: null,
          error_code: null,
          vendor_id: null,
          device_type: null,
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

      const result = await service.createTemplate(name, selectedCards, widgets);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(templateRepo.createTemplate).toHaveBeenCalledWith(name, selectedCards, 1, mockClient);
      expect(presetRepo.upsertPreset).toHaveBeenCalledWith(
        expect.objectContaining({ device_id: 'DEV001' }),
        mockClient,
      );
      expect(widgetRepo.createWidget).toHaveBeenCalledWith(10, 'DEV001', mockClient);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result.template_id).toBe(10);
    });

    it('should rollback transaction and throw if creation fails', async () => {
      const name = 'Failing Template';
      const selectedCards = '[]';
      const widgets = [
        {
          device_id: 'DEV001',
          position: 1,
          chart_type: 'line',
          status: 'active',
          severity: null,
          error_code: null,
          vendor_id: null,
          device_type: null,
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
          device_id: 'DEV001',
          time_created: new Date(),
          time_updated: new Date(),
          preset: {
            device_id: 'DEV001',
            position: 1,
            chart_type: 'line',
            status: 'active',
            severity: 'critical',
            error_code: null,
            vendor_id: null,
            device_type: null,
          },
        },
      ];
      widgetRepo.getWidgetsWithPresetsByTemplateId.mockResolvedValue(widgetData);

      const result = await service.getTemplateById(1);

      expect(templateRepo.getTemplateById).toHaveBeenCalledWith(1);
      expect(widgetRepo.getWidgetsWithPresetsByTemplateId).toHaveBeenCalledWith(1);
      expect(result).not.toBeNull();
      expect(result!.widgets.length).toBe(1);
      expect(result!.widgets[0].preset.device_id).toBe('DEV001');
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

      const widgets = [
        {
          device_id: 'DEV002',
          position: 2,
          chart_type: 'bar',
          status: null,
          severity: null,
          error_code: null,
          vendor_id: null,
          device_type: null,
        },
      ];

      const result = await service.updateTemplate(1, 'New Name', undefined, widgets);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(widgetRepo.deleteWidgetsByTemplateId).toHaveBeenCalledWith(1, mockClient);
      expect(presetRepo.upsertPreset).toHaveBeenCalledWith(
        expect.objectContaining({ device_id: 'DEV002' }),
        mockClient,
      );
      expect(widgetRepo.createWidget).toHaveBeenCalledWith(1, 'DEV002', mockClient);
      expect(templateRepo.updateTemplate).toHaveBeenCalledWith(
        1,
        { name: 'New Name', number_of_widgets: 1 },
        mockClient,
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result!.name).toBe('New Name');
    });

    it('should return null when updating a non-existent template', async () => {
      templateRepo.getTemplateById.mockResolvedValue(null);

      const result = await service.updateTemplate(999, 'Non-existent');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should delete template successfully', async () => {
      templateRepo.deleteTemplate.mockResolvedValue(true);

      const result = await service.deleteTemplate(1);

      expect(templateRepo.deleteTemplate).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });
});
