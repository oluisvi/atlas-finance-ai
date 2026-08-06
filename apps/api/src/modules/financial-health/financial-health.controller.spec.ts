import { FinancialHealthController } from "./financial-health.controller.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { createAuthenticatedUser } from "../../test-utils/financial-fixtures.js";

describe("FinancialHealthController", () => {
  it("delegates the authenticated user id and validated query to the service", async () => {
    const user: AuthenticatedUser = createAuthenticatedUser({ id: "00000000-0000-4000-8000-000000000001" });
    const calculate = jest.fn().mockResolvedValue({ score: 80 });
    const controller = new FinancialHealthController({ calculate });
    await expect(controller.get(user, { currency: "BRL" })).resolves.toEqual({ score: 80 });
    expect(calculate).toHaveBeenCalledWith(user.id, { currency: "BRL" });
  });
});
