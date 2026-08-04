import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CategoryResponse } from "./category.types.js";
import type { CreateCategoryDto } from "./dto/create-category.dto.js";
import type { UpdateCategoryDto } from "./dto/update-category.dto.js";

const ACTIVE = "ACTIVE";
const DELETED = "DELETED";
const categorySelect = { color: true, createdAt: true, icon: true, id: true, isDefault: true, isEssential: true, name: true, parentId: true, sortOrder: true, status: true, type: true, updatedAt: true } as const;

@Injectable()
export class CategoriesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryResponse> {
    if (dto.parentId) await this.requireOwnedParent(userId, dto.parentId);
    try {
      const category = await this.prisma.category.create({ data: { color: dto.color, icon: dto.icon, isEssential: dto.isEssential, name: dto.name.trim(), parentId: dto.parentId, sortOrder: dto.sortOrder, type: dto.type, userId }, select: categorySelect });
      await this.audit.record({ action: "category.create", actorUserId: userId, entityId: category.id, entityType: "category", eventType: "ENTITY_CREATED", riskLevel: "LOW", userId });
      return category;
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException({ code: "CATEGORY_DUPLICATE", message: "A category with this name and type already exists" });
      throw error;
    }
  }

  async list(userId: string): Promise<CategoryResponse[]> {
    return this.prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }], select: categorySelect, where: { deletedAt: null, status: ACTIVE, OR: [{ userId }, { isDefault: true, userId: null }] } });
  }

  async findOne(userId: string, id: string): Promise<CategoryResponse> {
    const category = await this.prisma.category.findFirst({ select: categorySelect, where: { deletedAt: null, id, OR: [{ userId }, { isDefault: true, userId: null }] } });
    if (!category) throw this.notFound();
    return category;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryResponse> {
    await this.requireOwned(userId, id);
    if (dto.parentId) await this.requireOwnedParent(userId, dto.parentId, id);
    try {
      const category = await this.prisma.category.update({ data: { color: dto.color, icon: dto.icon, isEssential: dto.isEssential, name: dto.name?.trim(), parentId: dto.parentId, sortOrder: dto.sortOrder, status: dto.status, type: dto.type }, select: categorySelect, where: { id } });
      await this.audit.record({ action: "category.update", actorUserId: userId, entityId: id, entityType: "category", eventType: "ENTITY_UPDATED", riskLevel: "LOW", userId });
      return category;
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException({ code: "CATEGORY_DUPLICATE", message: "A category with this name and type already exists" });
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    const [children, transactions, limits, recurring, importItems, summaries] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }), this.prisma.transaction.count({ where: { categoryId: id } }), this.prisma.budgetCategoryLimit.count({ where: { categoryId: id } }), this.prisma.recurringTransaction.count({ where: { categoryId: id } }), this.prisma.importItem.count({ where: { suggestedCategoryId: id } }), this.prisma.monthlyCategorySummary.count({ where: { categoryId: id } })
    ]);
    if (children + transactions + limits + recurring + importItems + summaries > 0) throw new ConflictException({ code: "CATEGORY_IN_USE", message: "Category cannot be deleted while related records exist" });
    await this.prisma.category.update({ data: { deletedAt: new Date(), status: DELETED }, where: { id } });
    await this.audit.record({ action: "category.delete", actorUserId: userId, entityId: id, entityType: "category", eventType: "ENTITY_DELETED", riskLevel: "MEDIUM", userId });
  }

  private async requireOwned(userId: string, id: string): Promise<void> { if (!await this.prisma.category.findFirst({ select: { id: true }, where: { deletedAt: null, id, userId } })) throw this.notFound(); }
  private async requireOwnedParent(userId: string, parentId: string, currentId?: string): Promise<void> { if (parentId === currentId || !await this.prisma.category.findFirst({ select: { id: true }, where: { deletedAt: null, id: parentId, userId } })) throw new ConflictException({ code: "CATEGORY_PARENT_INVALID", message: "Parent category must belong to the authenticated user" }); }
  private isUniqueViolation(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"; }
  private notFound(): NotFoundException { return new NotFoundException({ code: "CATEGORY_NOT_FOUND", message: "Category not found" }); }
}
