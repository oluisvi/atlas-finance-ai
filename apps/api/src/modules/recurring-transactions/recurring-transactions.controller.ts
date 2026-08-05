import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards, ValidationPipe } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CreateRecurringTransactionDto, ListRecurringTransactionsDto, UpdateRecurringTransactionDto } from "./dto/recurring-transaction.dto.js";
import { RecurringTransactionsService } from "./recurring-transactions.service.js";
const validation = new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true });
@Controller("recurring-transactions") @UseGuards(JwtAuthGuard)
export class RecurringTransactionsController {
  constructor(@Inject(RecurringTransactionsService) private readonly service: RecurringTransactionsService) {}
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body(validation) dto: CreateRecurringTransactionDto) { return this.service.create(user.id, dto); }
  @Get() list(@CurrentUser() user: AuthenticatedUser, @Query(validation) dto: ListRecurringTransactionsDto) { return this.service.list(user.id, dto); }
  @Get(":id") findOne(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.findOne(user.id, id); }
  @Patch(":id") update(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body(validation) dto: UpdateRecurringTransactionDto) { return this.service.update(user.id, id, dto); }
  @Delete(":id") @HttpCode(204) async remove(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string): Promise<void> { await this.service.remove(user.id, id); }
  @Post(":id/pause") pause(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.pause(user.id, id); }
  @Post(":id/resume") resume(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.resume(user.id, id); }
  @Post(":id/cancel") cancel(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.cancel(user.id, id); }
  @Post(":id/run") run(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.service.run(user.id, id); }
}
