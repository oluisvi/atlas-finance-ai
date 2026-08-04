import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";

import { PrismaModule } from "./prisma.module.js";
import { PrismaService } from "./prisma.service.js";

describe("PrismaModule", () => {
  it("provides PrismaService", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === "database.url") {
                return "postgresql://postgres:postgres@localhost:5432/postgres";
              }
              if (key === "database.poolMax") {
                return 1;
              }
              return undefined;
            }
          }
        }
      ]
    })
      .compile();

    const prismaService = moduleRef.get(PrismaService);

    expect(prismaService).toBeDefined();
    expect(typeof prismaService.checkConnection).toBe("function");
    await moduleRef.close();
  });
});
