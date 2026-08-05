import { Prisma } from "@prisma/client";
import { budgetUsage } from "./dashboard.service.js";
describe("Dashboard budget usage", () => {
  const limit = new Prisma.Decimal("100.0000");
  it.each([["79.9999", "NORMAL", "20.0001", "80.00"], ["80.0000", "ALERT", "20", "80.00"], ["99.9999", "ALERT", "0.0001", "100.00"], ["100.0000", "EXCEEDED", "0", "100.00"], ["120.0000", "EXCEEDED", "-20", "120.00"]] as const)("classifies %s as %s", (spent, status, remaining, percentage) => { const result = budgetUsage(limit, new Prisma.Decimal(spent)); expect(result.status).toBe(status); expect(result.percentage).toBe(percentage); expect(result.remaining.toString()).toBe(remaining); });
  it("does not create non-finite values for zero limits", () => { const result = budgetUsage(new Prisma.Decimal(0), new Prisma.Decimal(0)); expect(result.percentage).toBe("0.00"); expect(result.status).toBe("NORMAL"); });
});
