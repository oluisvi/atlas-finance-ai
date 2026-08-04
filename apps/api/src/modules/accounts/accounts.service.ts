import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { AuditService } from "../audit/audit.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CreateAccountDto } from "./dto/create-account.dto.js";
import type { UpdateAccountDto } from "./dto/update-account.dto.js";
import type { AccountResponse } from "./account.types.js";

const ACTIVE = "ACTIVE";
const ARCHIVED = "ARCHIVED";
const DELETED = "DELETED";

const accountSelect = { archivedAt: true, color: true, createdAt: true, currency: true, currentBalance: true, id: true, icon: true, includeInDashboard: true, initialBalance: true, name: true, status: true, type: true, updatedAt: true } as const;

function present(account: { initialBalance: { toString(): string }; currentBalance: { toString(): string } } & Omit<AccountResponse, "initialBalance" | "currentBalance">): AccountResponse {
  return { ...account, currentBalance: account.currentBalance.toString(), initialBalance: account.initialBalance.toString() };
}

@Injectable()
export class AccountsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService) {}

  async create(userId: string, dto: CreateAccountDto): Promise<AccountResponse> {
    const initialBalance = dto.initialBalance ?? "0";
    const account = await this.prisma.account.create({
      data: { color: dto.color, currency: dto.currency?.toUpperCase(), currentBalance: initialBalance, icon: dto.icon, includeInDashboard: dto.includeInDashboard, initialBalance, name: dto.name.trim(), type: dto.type, userId },
      select: accountSelect
    });
    await this.audit.record({ action: "account.create", actorUserId: userId, entityId: account.id, entityType: "account", eventType: "ENTITY_CREATED", riskLevel: "LOW", userId });
    return present(account);
  }

  async list(userId: string): Promise<AccountResponse[]> {
    const accounts = await this.prisma.account.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: accountSelect, where: { deletedAt: null, userId } });
    return accounts.map(present);
  }

  async findOne(userId: string, id: string): Promise<AccountResponse> {
    const account = await this.prisma.account.findFirst({ select: accountSelect, where: { deletedAt: null, id, userId } });
    if (!account) throw this.notFound();
    return present(account);
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<AccountResponse> {
    await this.requireOwned(userId, id);
    const status = dto.status ? String(dto.status) : undefined;
    const account = await this.prisma.account.update({
      data: { color: dto.color, icon: dto.icon, includeInDashboard: dto.includeInDashboard, name: dto.name?.trim(), status: status as never, archivedAt: status === ARCHIVED ? new Date() : status === ACTIVE ? null : undefined },
      select: accountSelect,
      where: { id }
    });
    await this.audit.record({ action: "account.update", actorUserId: userId, entityId: id, entityType: "account", eventType: "ENTITY_UPDATED", riskLevel: "LOW", userId });
    return present(account);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    const [transactions, outgoingTransfers, incomingTransfers, recurringTransactions, importBatches, importItems, snapshots] = await Promise.all([
      this.prisma.transaction.count({ where: { accountId: id } }), this.prisma.transfer.count({ where: { fromAccountId: id } }), this.prisma.transfer.count({ where: { toAccountId: id } }), this.prisma.recurringTransaction.count({ where: { accountId: id } }), this.prisma.importBatch.count({ where: { accountId: id } }), this.prisma.importItem.count({ where: { accountId: id } }), this.prisma.accountBalanceSnapshot.count({ where: { accountId: id } })
    ]);
    if (transactions + outgoingTransfers + incomingTransfers + recurringTransactions + importBatches + importItems + snapshots > 0) {
      throw new ConflictException({ code: "ACCOUNT_IN_USE", message: "Account cannot be deleted while related records exist" });
    }
    await this.prisma.account.update({ data: { deletedAt: new Date(), status: DELETED }, where: { id } });
    await this.audit.record({ action: "account.delete", actorUserId: userId, entityId: id, entityType: "account", eventType: "ENTITY_DELETED", riskLevel: "MEDIUM", userId });
  }

  private async requireOwned(userId: string, id: string): Promise<void> { if (!await this.prisma.account.findFirst({ select: { id: true }, where: { deletedAt: null, id, userId } })) throw this.notFound(); }
  private notFound(): NotFoundException { return new NotFoundException({ code: "ACCOUNT_NOT_FOUND", message: "Account not found" }); }
}
