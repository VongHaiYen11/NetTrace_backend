export function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export function buildClickhouseFilters(params: {
  severity?: string;
  status?: string;
  device_id?: string;
  error_code?: string;
}) {
  const conditions: string[] = [];
  const queryParams: Record<string, unknown> = {};

  if (params.severity) {
    conditions.push('severity = {severity: String}');
    queryParams.severity = params.severity;
  }
  if (params.status) {
    conditions.push('status = {status: String}');
    queryParams.status = params.status;
  }
  if (params.device_id) {
    conditions.push('device_id = {device_id: String}');
    queryParams.device_id = params.device_id;
  }
  if (params.error_code) {
    conditions.push('error_code = {error_code: String}');
    queryParams.error_code = params.error_code;
  }

  return { conditions, queryParams };
}
