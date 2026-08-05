import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, ValidationPipe } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CreateGoalContributionDto, CreateGoalDto, ListGoalsDto, UpdateGoalDto } from "./dto/goal.dto.js";
import { GoalsService } from "./goals.service.js";
const validation = new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true });
@Controller("goals") @UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(@Inject(GoalsService) private readonly service: GoalsService) {}
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body(validation) dto: CreateGoalDto) { return this.service.create(user.id, dto); }
  @Get() list(@CurrentUser() user: AuthenticatedUser, @Query(validation) dto: ListGoalsDto) { return this.service.list(user.id, dto); }
  @Get(":id") one(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.findOne(user.id, id); }
  @Patch(":id") update(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body(validation) dto: UpdateGoalDto) { return this.service.update(user.id, id, dto); }
  @Delete(":id") @HttpCode(204) async remove(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string): Promise<void> { await this.service.remove(user.id, id); }
  @Post(":id/contributions") addContribution(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body(validation) dto: CreateGoalContributionDto) { return this.service.addContribution(user.id, id, dto); }
  @Get(":id/contributions") listContributions(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.listContributions(user.id, id); }
  @Delete(":id/contributions/:contributionId") @HttpCode(204) async removeContribution(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Param("contributionId", new ParseUUIDPipe({ version: "4" })) contributionId: string): Promise<void> { await this.service.removeContribution(user.id, id, contributionId); }
}
