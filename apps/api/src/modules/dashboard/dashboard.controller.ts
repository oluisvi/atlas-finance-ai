import { Controller, Get, Inject, Query, UseGuards, ValidationPipe } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CashFlowDto, DashboardPeriodDto, RecentTransactionsDto } from "./dto/dashboard.dto.js";
import { DashboardService } from "./dashboard.service.js";
const validation = new ValidationPipe({ forbidNonWhitelisted: true, transform: true, whitelist: true });
@Controller("dashboard") @UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly service: DashboardService) {}
  @Get("overview") overview(@CurrentUser() user: AuthenticatedUser, @Query(validation) query: DashboardPeriodDto) { return this.service.overview(user.id, query); }
  @Get("cash-flow") cashFlow(@CurrentUser() user: AuthenticatedUser, @Query(validation) query: CashFlowDto) { return this.service.cashFlow(user.id, query); }
  @Get("categories") categories(@CurrentUser() user: AuthenticatedUser, @Query(validation) query: DashboardPeriodDto) { return this.service.categories(user.id, query); }
  @Get("accounts") accounts(@CurrentUser() user: AuthenticatedUser, @Query(validation) query: DashboardPeriodDto) { return this.service.accounts(user.id, query); }
  @Get("budgets") budgets(@CurrentUser() user: AuthenticatedUser, @Query(validation) query: DashboardPeriodDto) { return this.service.budgets(user.id, query); }
  @Get("goals") goals(@CurrentUser() user: AuthenticatedUser, @Query(validation) query: DashboardPeriodDto) { return this.service.goals(user.id, query); }
  @Get("recurring") recurring(@CurrentUser() user: AuthenticatedUser, @Query(validation) query: DashboardPeriodDto) { return this.service.recurring(user.id, query); }
  @Get("recent-transactions") recent(@CurrentUser() user: AuthenticatedUser, @Query(validation) query: RecentTransactionsDto) { return this.service.recentTransactions(user.id, query); }
}
