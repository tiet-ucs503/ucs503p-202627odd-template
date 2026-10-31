export type ErrorFields = Record<string, string[]>;

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fields: ErrorFields | undefined;
  readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options: {
      fields?: ErrorFields;
      cause?: unknown;
      isOperational?: boolean;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.fields = options.fields;
    this.isOperational = options.isOperational ?? true;
  }
}
