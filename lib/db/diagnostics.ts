import { Prisma } from "@prisma/client";

export type DatabaseDiagnosticDependency = "required" | "optional";

export type DatabaseDiagnosticResult = {
  ok: false;
  code: string;
  message: string;
  hint: string;
  dependency: DatabaseDiagnosticDependency;
  operation: string;
  prismaCode: string | null;
};

type LogDatabaseDiagnosticInput = {
  module: string;
  route: string;
  operation: string;
  dependency: DatabaseDiagnosticDependency;
  error: unknown;
  code: string;
  clientMessage: string;
  model?: string;
  table?: string;
  queryType?: string;
};

const CONNECTION_STRING_PATTERN = /\b(?:postgres(?:ql)?|mysql|sqlserver|mongodb|prisma):\/\/[^\s'"]+/gi;
const CREDENTIAL_PAIR_PATTERN = /\b(password|pwd|token|secret|apikey|api_key)=([^&\s]+)/gi;

function sanitizeText(value: string): string {
  return value
    .replace(CONNECTION_STRING_PATTERN, "[REDACTED_CONNECTION_STRING]")
    .replace(CREDENTIAL_PAIR_PATTERN, (_full, key: string) => `${key}=[REDACTED]`);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown database error.";
}

function getPrismaCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }

  return null;
}

export function logDatabaseDiagnostic(input: LogDatabaseDiagnosticInput): DatabaseDiagnosticResult {
  const prismaCode = getPrismaCode(input.error);
  const safeServerErrorMessage = sanitizeText(getErrorMessage(input.error));

  console.error("[DatabaseDiagnostic]", {
    module: input.module,
    route: input.route,
    operation: input.operation,
    model: input.model ?? null,
    table: input.table ?? null,
    queryType: input.queryType ?? null,
    dependency: input.dependency,
    code: input.code,
    prismaCode,
    errorMessage: safeServerErrorMessage,
  });

  const message =
    process.env.NODE_ENV === "production"
      ? input.clientMessage
      : `${input.clientMessage} (${safeServerErrorMessage})`;

  return {
    ok: false,
    code: input.code,
    message,
    hint: `Check server logs for diagnostic code ${input.code}.`,
    dependency: input.dependency,
    operation: input.operation,
    prismaCode,
  };
}
