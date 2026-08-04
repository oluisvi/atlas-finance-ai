import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { CategoriesController } from "./categories.controller.js";
import { CategoriesService } from "./categories.service.js";
@Module({ controllers: [CategoriesController], imports: [AuditModule, AuthModule], providers: [CategoriesService] })
export class CategoriesModule {}
