import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import { AuthService } from "../auth.service.js";
import type { AuthenticatedRequest } from "../auth.types.js";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException({ code: "AUTH_UNAUTHORIZED", message: "Authentication is required" });
    }

    request.authUser = await this.authService.validateAccessToken(token);
    return true;
  }
}
