import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, ValidationPipe } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { GenerateInsightsDto, ListInsightsDto } from "./dto/insights.dto.js";
import { InsightsService } from "./insights.service.js";
type InsightsOperations = Pick<InsightsService, "list" | "one" | "generate" | "read" | "dismiss">;
@Controller("insights") @UseGuards(JwtAuthGuard) export class InsightsController {constructor(@Inject(InsightsService)private readonly service:InsightsOperations){} @Get() list(@CurrentUser()u:AuthenticatedUser,@Query(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}))d:ListInsightsDto){return this.service.list(u.id,d)} @Get(":id") one(@CurrentUser()u:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"}))id:string){return this.service.one(u.id,id)} @Post("generate") generate(@CurrentUser()u:AuthenticatedUser,@Body(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}))d:GenerateInsightsDto){return this.service.generate(u.id,d)} @Patch(":id/read") read(@CurrentUser()u:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"}))id:string){return this.service.read(u.id,id)} @Patch(":id/dismiss") dismiss(@CurrentUser()u:AuthenticatedUser,@Param("id",new ParseUUIDPipe({version:"4"}))id:string){return this.service.dismiss(u.id,id)}}
