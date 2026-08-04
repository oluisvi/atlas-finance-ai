import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AccountsController } from "./accounts.controller.js";
import { AccountsService } from "./accounts.service.js";
@Module({ controllers: [AccountsController], imports: [AuditModule, AuthModule], providers: [AccountsService] })
export class AccountsModule {}
