export function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export function buildClickhouseFilters(params: {
  severity?: string[];
  status?: string[];
  device_id?: string[];
  error_code?: string[];
}) {
  const conditions: string[] = [];
  const queryParams: Record<string, unknown> = {};

  if (params.severity && params.severity.length > 0) {
    conditions.push('severity_normalized IN {severity: Array(String)}');
    queryParams.severity = params.severity.map((s) => s.toLowerCase());
  }
  if (params.status && params.status.length > 0) {
    conditions.push('status_normalized IN {status: Array(String)}');
    queryParams.status = params.status.map((s) => s.toLowerCase());
  }
  if (params.device_id && params.device_id.length > 0) {
    conditions.push('device_id_normalized IN {device_id: Array(String)}');
    queryParams.device_id = params.device_id.map((s) => s.toLowerCase());
  }
  if (params.error_code && params.error_code.length > 0) {
    conditions.push('error_code_normalized IN {error_code: Array(String)}');
    queryParams.error_code = params.error_code.map((s) => s.toLowerCase());
  }

  return { conditions, queryParams };
}
