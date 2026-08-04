import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { AuditService } from "./audit.service.js";

@Module({
  exports: [AuditService],
  imports: [PrismaModule],
  providers: [AuditService]
})
export class AuditModule {}
