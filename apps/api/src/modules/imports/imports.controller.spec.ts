import { BadRequestException } from "@nestjs/common";

import { ImportsController } from "./imports.controller.js";
import { ImportSourceDto } from "./dto/imports.dto.js";
import type { ImportsService } from "./imports.service.js";

describe("ImportsController multipart upload", () => {
  it("adapts a buffered multipart file to the existing import service contract", async () => {
    const upload = jest.fn().mockResolvedValue({ id: "batch" });
    const controller = new ImportsController({ upload } as unknown as ImportsService);
    const file = { originalname: "statement.csv", buffer: Buffer.from("date,description,amount") };

    await expect(controller.upload({ id: "user", sessionId: "session" }, { accountId: "4b043d64-52d6-4de7-b99d-fb0b88a90db8", sourceType: ImportSourceDto.CSV }, file)).resolves.toEqual({ id: "batch" });
    expect(upload).toHaveBeenCalledWith("user", { accountId: "4b043d64-52d6-4de7-b99d-fb0b88a90db8", sourceType: "CSV", fileName: "statement.csv", contentBase64: file.buffer.toString("base64") });
  });

  it("rejects a multipart request without a file", () => {
    const controller = new ImportsController({ upload: jest.fn() } as unknown as ImportsService);
    expect(() => controller.upload({ id: "user", sessionId: "session" }, { accountId: "4b043d64-52d6-4de7-b99d-fb0b88a90db8", sourceType: ImportSourceDto.CSV })).toThrow(BadRequestException);
  });
});
