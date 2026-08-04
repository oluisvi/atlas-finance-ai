import { Controller, Get, Inject } from "@nestjs/common";

import { HealthService } from "./health.service.js";
import type { HealthResponse, LivenessResponse } from "./health.types.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  async getHealth(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }

  @Get("liveness")
  getLiveness(): LivenessResponse {
    return this.healthService.getLiveness();
  }

  @Get("readiness")
  async getReadiness(): Promise<HealthResponse> {
    return this.healthService.getHealth();
  }
}
