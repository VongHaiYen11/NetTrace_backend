import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Card, CardContent } from '../../../components/ui/Card';
import { Field, Input, Select } from '../../../components/ui/Field';
import type { DashboardFilterFormValues } from '../types';
import { defaultFilterValues } from '../filter-utils';

const filterSchema = z.object({
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  severity: z.string(),
  status: z.string(),
  deviceId: z.string(),
  errorCode: z.string(),
  province: z.string(),
});

interface DashboardFiltersProps {
  values: DashboardFilterFormValues;
  onApply: (values: DashboardFilterFormValues) => void;
}

export function DashboardFilters({ values, onApply }: DashboardFiltersProps) {
  const { register, handleSubmit, reset, setError, formState } = useForm<DashboardFilterFormValues>({
    values,
  });

  function submit(nextValues: DashboardFilterFormValues) {
    const parsed = filterSchema.safeParse(nextValues);
    if (!parsed.success) {
      setError('fromDate', { message: 'Cần chọn khoảng thời gian.' });
      return;
    }
    onApply(parsed.data);
  }

  function resetFilters() {
    const nextValues = defaultFilterValues();
    reset(nextValues);
    onApply(nextValues);
  }

  return (
    <Card>
      <CardContent>
        <form className="grid gap-4 lg:grid-cols-12" onSubmit={handleSubmit(submit)}>
          <div className="flex items-center gap-2 lg:col-span-12">
            <Filter size={18} className="text-muted" />
            <h2 className="text-sm font-semibold text-[#f3edff]">Bộ lọc cảnh báo</h2>
          </div>
          <Field label="Từ ngày">
            <Input type="date" {...register('fromDate')} />
          </Field>
          <Field label="Đến ngày">
            <Input type="date" {...register('toDate')} />
          </Field>
          <Field label="Mức độ">
            <Select {...register('severity')}>
              <option value="">Tất cả</option>
              <option value="critical">Nghiêm trọng</option>
              <option value="major">Lớn</option>
              <option value="minor">Nhỏ</option>
              <option value="warning">Cảnh báo</option>
              <option value="info">Thông tin</option>
            </Select>
          </Field>
          <Field label="Trạng thái">
            <Select {...register('status')}>
              <option value="">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="archived">Đã đóng</option>
            </Select>
          </Field>
          <Field label="Mã thiết bị" hint="Phân tách bằng dấu phẩy">
            <Input placeholder="DEV001, DEV002" {...register('deviceId')} />
          </Field>
          <Field label="Mã lỗi" hint="Phân tách bằng dấu phẩy">
            <Input placeholder="ERR_LINK_DOWN" {...register('errorCode')} />
          </Field>
          <Field label="Tỉnh thành" hint="Phân tách bằng dấu phẩy">
            <Input placeholder="Hà Nội" {...register('province')} />
          </Field>

          <div className="flex items-end gap-2 lg:col-span-2">
            <Button className="w-full" type="submit" disabled={formState.isSubmitting}>
              <Search size={16} />
              Áp dụng
            </Button>
            <Button variant="secondary" size="icon" onClick={resetFilters}>
              <RotateCcw size={16} />
              <span className="sr-only">Đặt lại bộ lọc</span>
            </Button>
          </div>
          {formState.errors.fromDate ? (
            <p className="text-sm text-danger lg:col-span-12">{formState.errors.fromDate.message}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
