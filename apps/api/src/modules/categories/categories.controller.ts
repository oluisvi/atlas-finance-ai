import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CategoriesService } from "./categories.service.js";
import { CreateCategoryDto } from "./dto/create-category.dto.js";
import { UpdateCategoryDto } from "./dto/update-category.dto.js";
@Controller("categories") @UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCategoryDto) { return this.categoriesService.create(user.id, dto); }
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.categoriesService.list(user.id); }
  @Get(":id") findOne(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.categoriesService.findOne(user.id, id); }
  @Patch(":id") update(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() dto: UpdateCategoryDto) { return this.categoriesService.update(user.id, id, dto); }
  @Delete(":id") @HttpCode(204) async remove(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string): Promise<void> { await this.categoriesService.remove(user.id, id); }
}
