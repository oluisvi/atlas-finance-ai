import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createRequire } from "node:module";
import { join } from "node:path";
import { Pool } from "pg";

import type { AppConfiguration } from "../../config/app-config.types.js";
import type * as GeneratedPrismaModule from "../../../../../node_modules/.prisma/client/index.js";

const nodeRequire = createRequire(join(process.cwd(), "package.json"));
const generatedPrismaClientPath = join(process.cwd(), "node_modules", ".prisma", "client", "index.js");
const { PrismaClient } = nodeRequire(generatedPrismaClientPath) as typeof GeneratedPrismaModule;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor(@Inject(ConfigService) configService: ConfigService<AppConfiguration, true>) {
    const connectionString = configService.get("database.url", { infer: true });
    const max = configService.get("database.poolMax", { infer: true });
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      max
    });

    super({
      adapter: new PrismaPg(pool)
    });

    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log("Prisma connected to PostgreSQL");
    } catch (error) {
      this.logger.error("Prisma failed to connect to PostgreSQL");
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    await this.pool.end();
  }

  async checkConnection(): Promise<void> {
    await this.$queryRaw<Array<{ ok: number }>>`SELECT 1::int AS ok`;
  }
}
