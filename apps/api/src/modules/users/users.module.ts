import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module.js";
import { UsersService } from "./users.service.js";

@Module({
  exports: [UsersService],
  imports: [PrismaModule],
  providers: [UsersService]
})
export class UsersModule {}
