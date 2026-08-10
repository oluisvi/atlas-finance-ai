import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import type { Request, Response } from "express";

interface ErrorResponseBody {
  code: string;
  message: string | string[];
  method: string;
  path: string;
  requestId: string;
  statusCode: number;
  timestamp: string;
}

function extractHttpMessage(response: string | object): string | string[] {
  if (typeof response === "string") {
    return response;
  }

  if ("message" in response) {
    const message = response.message;
    if (typeof message === "string" || Array.isArray(message)) {
      return message;
    }
  }

  return "Request failed";
}

function extractHttpCode(response: string | object, statusCode: number): string {
  if (typeof response !== "string" && "code" in response) {
    const code = response.code;
    if (typeof code === "string") {
      return code;
    }
  }

  return `HTTP_${statusCode}`;
}

function parserStatus(exception: unknown): number | undefined {
  if (!exception || typeof exception !== "object" || !("status" in exception)) return undefined;
  const status = exception.status;
  return status === 400 || status === 413 ? status : undefined;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const statusCode = exception instanceof HttpException ? exception.getStatus() : parserStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : statusCode === 413 ? { code: "PAYLOAD_TOO_LARGE", message: "Payload too large" } : statusCode === 400 ? { code: "MALFORMED_REQUEST_BODY", message: "Malformed request body" } : "Internal server error";
    const isInternalServerError = statusCode === 500;

    if (!(exception instanceof HttpException) && statusCode === 500) {
      this.logger.error(JSON.stringify({ error: "unhandled_exception", method: request.method, path: request.url, requestId: response.locals.requestId }), exception instanceof Error ? exception.stack : undefined);
    }

    const body: ErrorResponseBody = {
      code: extractHttpCode(exceptionResponse, statusCode),
      message:
        isInternalServerError
          ? "Internal server error"
          : extractHttpMessage(exceptionResponse),
      method: request.method,
      path: request.url,
      requestId: String(response.locals.requestId ?? "unknown"),
      statusCode,
      timestamp: new Date().toISOString()
    };

    response.status(statusCode).json(body);
  }
}
