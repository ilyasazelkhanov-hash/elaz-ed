export class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.name = 'ApiError'; this.status = status }
}
export function requireValue(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new ApiError(message, status)
}
