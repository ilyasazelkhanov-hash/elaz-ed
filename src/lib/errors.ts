/** Ошибка сервера с кодом: по нему интерфейс решает, что показать. */
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code)
  }
}
