import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { AccountsService } from "./accounts.service.js";
import { CreateAccountDto } from "./dto/create-account.dto.js";
import { UpdateAccountDto } from "./dto/update-account.dto.js";

@Controller("accounts")
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accountsService: AccountsService) {}
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAccountDto) { return this.accountsService.create(user.id, dto); }
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.accountsService.list(user.id); }
  @Get(":id") findOne(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.accountsService.findOne(user.id, id); }
  @Patch(":id") update(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: UpdateAccountDto) { return this.accountsService.update(user.id, id, dto); }
  @Delete(":id") @HttpCode(204) async remove(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string): Promise<void> { await this.accountsService.remove(user.id, id); }
}
