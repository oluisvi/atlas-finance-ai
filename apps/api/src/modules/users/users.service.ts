import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";
import type { PublicUser } from "./user.types.js";

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findActiveByEmail(emailNormalized: string) {
    return this.prisma.user.findFirst({
      where: { deletedAt: null, emailNormalized }
    });
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findFirst({
      select: {
        createdAt: true,
        email: true,
        emailVerifiedAt: true,
        id: true,
        name: true,
        status: true,
        updatedAt: true
      },
      where: { deletedAt: null, id }
    });
  }
}
