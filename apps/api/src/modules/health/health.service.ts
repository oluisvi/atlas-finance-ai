import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";
import type { HealthResponse, LivenessResponse } from "./health.types.js";

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  getLiveness(): LivenessResponse {
    return {
      services: {
        app: {
          status: "up"
        }
      },
      status: "ok",
      timestamp: new Date().toISOString()
    };
  }

  async getHealth(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();

    try {
      await this.prisma.checkConnection();
    } catch {
      throw new ServiceUnavailableException({
        code: "DATABASE_UNAVAILABLE",
        message: "Database connection is unavailable",
        status: "error",
        timestamp
      });
    }

    return {
      services: {
        app: {
          status: "up"
        },
        database: {
          status: "up"
        }
      },
      status: "ok",
      timestamp
    };
  }
}
