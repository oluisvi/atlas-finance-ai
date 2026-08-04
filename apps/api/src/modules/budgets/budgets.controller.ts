import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, ValidationPipe } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { BudgetsService } from "./budgets.service.js";
import { CreateBudgetCategoryLimitDto, CreateBudgetDto, ListBudgetsDto, UpdateBudgetCategoryLimitDto, UpdateBudgetDto } from "./dto/budget.dto.js";

const validation = new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true });
@Controller("budgets") @UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(@Inject(BudgetsService) private readonly service: BudgetsService) {}
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body(validation) dto: CreateBudgetDto) { return this.service.create(user.id, dto); }
  @Get() list(@CurrentUser() user: AuthenticatedUser, @Query(validation) dto: ListBudgetsDto) { return this.service.list(user.id, dto); }
  @Get("current") current(@CurrentUser() user: AuthenticatedUser) { return this.service.current(user.id); }
  @Get(":id") one(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.findOne(user.id, id); }
  @Patch(":id") update(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body(validation) dto: UpdateBudgetDto) { return this.service.update(user.id, id, dto); }
  @Delete(":id") @HttpCode(204) async remove(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string): Promise<void> { await this.service.remove(user.id, id); }
  @Post(":id/categories") addLimit(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body(validation) dto: CreateBudgetCategoryLimitDto) { return this.service.addLimit(user.id, id, dto); }
  @Patch(":id/categories/:limitId") updateLimit(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Param("limitId", new ParseUUIDPipe({ version: "4" })) limitId: string, @Body(validation) dto: UpdateBudgetCategoryLimitDto) { return this.service.updateLimit(user.id, id, limitId, dto); }
  @Delete(":id/categories/:limitId") @HttpCode(204) async removeLimit(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Param("limitId", new ParseUUIDPipe({ version: "4" })) limitId: string): Promise<void> { await this.service.removeLimit(user.id, id, limitId); }
}
