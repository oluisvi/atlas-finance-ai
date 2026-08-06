import { Inject, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

interface AuditEventInput {
  action: string;
  actorUserId?: string;
  entityId?: string;
  entityType?: string;
  eventType: "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGOUT" | "ENTITY_CREATED" | "ENTITY_UPDATED" | "ENTITY_DELETED" | "IMPORT_COMPLETED" | "SECURITY_EVENT";
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  userAgent?: string;
  userId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(input: AuditEventInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: input.action,
          actorUserId: input.actorUserId,
          entityId: input.entityId,
          entityType: input.entityType,
          eventType: input.eventType,
          ipAddress: input.ipAddress,
          metadata: input.metadata as never,
          riskLevel: input.riskLevel,
          userAgent: input.userAgent,
          userId: input.userId
        }
      });
    } catch {
      this.logger.error(`Unable to persist audit event: ${input.action}`);
    }
  }
}
