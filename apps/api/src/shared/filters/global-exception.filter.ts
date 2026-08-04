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

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : "Internal server error";
    const isInternalServerError = statusCode === 500;

    if (!(exception instanceof HttpException)) {
      this.logger.error("Unhandled application exception", exception instanceof Error ? exception.stack : undefined);
    }

    const body: ErrorResponseBody = {
      code: extractHttpCode(exceptionResponse, statusCode),
      message:
        isInternalServerError
          ? "Internal server error"
          : extractHttpMessage(exceptionResponse),
      method: request.method,
      path: request.url,
      statusCode,
      timestamp: new Date().toISOString()
    };

    response.status(statusCode).json(body);
  }
}
