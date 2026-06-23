import type { CommonFilters, SortBy, SortOrder } from '../../services/generated/nettrace-api';

export interface DashboardFilterFormValues {
  fromDate: string;
  toDate: string;
  severity: string;
  status: string;
  deviceId: string;
  errorCode: string;
  province: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
}

export type DashboardFilters = CommonFilters & {
  sort_by?: SortBy;
  sort_order?: SortOrder;
};
