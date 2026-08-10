import "reflect-metadata";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AuditEventType, FinancialInsightSeverity, FinancialInsightSource, FinancialInsightStatus, FinancialInsightType, InsightGenerationTrigger, Prisma, RunStatus, type FinancialInsight, type InsightGenerationRun } from "@prisma/client";
import { plainToInstance } from "class-transformer";
import type { AuditService } from "../audit/audit.service.js";
import { ListInsightsDto } from "./dto/insights.dto.js";
import { createInsightsDatabaseMock, type InsightsDatabaseMock } from "./insights-database.mock.js";
import { InsightsService, sanitizeInsightMetadata } from "./insights.service.js";
import { insightFingerprint } from "./insights.types.js";
import { context as detectionContext } from "./detectors/detector-test.fixture.js";
import type { DetectedInsight, InsightDetector } from "./detectors/insight-detector.interface.js";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000002";
const INSIGHT_ID = "00000000-0000-4000-8000-000000000003";
const RUN_ID = "00000000-0000-4000-8000-000000000004";
const START = new Date("2026-07-01T00:00:00.000Z");
const END = new Date("2026-07-31T00:00:00.000Z");
const FINGERPRINT = insightFingerprint({ userId: USER_ID, code: "INSIGHTS_ENGINE_READY", currency: "BRL", periodKey: "2026-07-01:2026-07-31", relatedEntityType: null, relatedEntityId: null });

const insight = (changes: Partial<FinancialInsight> = {}): FinancialInsight => ({ id: INSIGHT_ID, userId: USER_ID, type: FinancialInsightType.CASHFLOW_SUMMARY, source: FinancialInsightSource.RULE_ENGINE, periodStart: START, periodEnd: END, title: "Title", body: "Body", severity: FinancialInsightSeverity.INFO, confidence: null, dataPoints: { code: "INSIGHTS_ENGINE_READY", currency: "BRL", fingerprint: "private" }, actionLabel: null, status: FinancialInsightStatus.NEW, generatedByRunId: RUN_ID, createdAt: START, updatedAt: START, ...changes });
const run = (changes: Partial<InsightGenerationRun> = {}): InsightGenerationRun => ({ id: RUN_ID, userId: USER_ID, trigger: InsightGenerationTrigger.MANUAL, periodStart: START, periodEnd: END, status: RunStatus.RUNNING, inputSummary: {}, modelProvider: null, modelName: null, promptVersion: null, tokenInputCount: null, tokenOutputCount: null, errorCode: null, errorMessage: null, startedAt: START, finishedAt: null, createdAt: START, ...changes });

describe("InsightsService", () => {
  let database: InsightsDatabaseMock;
  let auditRecord: jest.MockedFunction<AuditService["record"]>;
  let service: InsightsService;

  beforeEach(() => {
    database = createInsightsDatabaseMock();
    auditRecord = jest.fn<ReturnType<AuditService["record"]>, Parameters<AuditService["record"]>>().mockResolvedValue();
    service = new InsightsService(database, { record: auditRecord });
    database.insightGenerationRun.create.mockResolvedValue(run());
    database.insightGenerationRun.update.mockResolvedValue(run({ status: RunStatus.COMPLETED, finishedAt: END }));
    database.financialInsight.findFirst.mockResolvedValue(null);
    database.financialInsight.findMany.mockResolvedValue([]);
    database.financialInsight.create.mockImplementation(({ data }) => Promise.resolve(insight({ userId: data.userId, type: data.type, source: data.source, periodStart: START, periodEnd: END, title: data.title, body: data.body, severity: data.severity ?? FinancialInsightSeverity.INFO, status: data.status ?? FinancialInsightStatus.NEW, generatedByRunId: data.generatedByRunId ?? null })));
    database.financialInsight.update.mockResolvedValue(insight());
  });

  describe("generation lifecycle and persistence", () => {
    it("creates a real running generation run with scope and sanitized input", async () => {
      await service.generate(USER_ID, { startDate: START.toISOString(), endDate: END.toISOString(), currency: "brl" });
      expect(database.insightGenerationRun.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: USER_ID, trigger: InsightGenerationTrigger.MANUAL, status: RunStatus.RUNNING, periodStart: START, periodEnd: END, startedAt: expect.any(Date), inputSummary: { currency: "BRL", origin: FinancialInsightSource.RULE_ENGINE, engine: "deterministic-v1" } }) });
    });

    it("persists the first insight with real enums, fingerprint and completes before auditing", async () => {
      const result = await service.generate(USER_ID, { startDate: START.toISOString(), endDate: END.toISOString(), currency: "BRL" });
      expect(database.financialInsight.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: USER_ID, type: FinancialInsightType.CASHFLOW_SUMMARY, source: FinancialInsightSource.RULE_ENGINE, severity: FinancialInsightSeverity.INFO, status: FinancialInsightStatus.NEW, dataPoints: expect.objectContaining({ fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), currency: "BRL" }) }) });
      expect(database.insightGenerationRun.update).toHaveBeenCalledWith({ where: { id: RUN_ID }, data: expect.objectContaining({ status: RunStatus.COMPLETED, finishedAt: expect.any(Date), tokenInputCount: 0, tokenOutputCount: 0 }) });
      expect(auditRecord).toHaveBeenCalledWith({ action: "insights.generate", actorUserId: USER_ID, userId: USER_ID, eventType: AuditEventType.INSIGHT_GENERATED, entityId: INSIGHT_ID, entityType: "financial_insight", metadata: { runId: RUN_ID, outcome: "created", trigger: InsightGenerationTrigger.MANUAL, currency: "BRL", periodStart: START.toISOString(), periodEnd: END.toISOString(), created: 1, updated: 0, skipped: 0, reactivated: 0 } });
      expect(result.insight?.dataPoints).toEqual({ code: "INSIGHTS_ENGINE_READY", currency: "BRL" });
      expect(result.summary).toEqual({ created: 1, updated: 0, skipped: 0, resolved:0, reactivated:0 });
    });

    it("deduplicates an equivalent generation and preserves read/dismiss state", async () => {
      const existing = insight({ title:"Financial insights are ready",body:"Your deterministic insight run completed.",status: FinancialInsightStatus.DISMISSED, dataPoints: { fingerprint: FINGERPRINT, currency: "BRL", code: "INSIGHTS_ENGINE_READY" } });
      database.financialInsight.findFirst.mockResolvedValue(existing);
      database.financialInsight.create.mockClear();
      const result = await service.generate(USER_ID, { startDate: START.toISOString(), endDate: END.toISOString(), currency: "BRL" });
      expect(database.financialInsight.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ userId: USER_ID, type: FinancialInsightType.CASHFLOW_SUMMARY, source: FinancialInsightSource.RULE_ENGINE, periodStart: START, periodEnd: END }) });
      expect(database.financialInsight.create).not.toHaveBeenCalled();
      expect(database.financialInsight.update).not.toHaveBeenCalled();
      expect(result.insight?.status).toBe(FinancialInsightStatus.DISMISSED);
      expect(result.summary.skipped).toBe(1);
    });

    it("updates changed metadata and severity without resetting status", async () => {
      database.financialInsight.findFirst.mockResolvedValue(insight({ severity: FinancialInsightSeverity.WARNING, status: FinancialInsightStatus.SEEN, dataPoints: { old: true } }));
      database.financialInsight.update.mockResolvedValue(insight({ status: FinancialInsightStatus.SEEN }));
      const result = await service.generate(USER_ID, { startDate: START.toISOString(), endDate: END.toISOString(), currency: "BRL" });
      expect(database.financialInsight.update).toHaveBeenCalledWith({ where: { id: INSIGHT_ID }, data: expect.not.objectContaining({ status: expect.anything() }) });
      expect(result.summary.updated).toBe(1);
    });

    it.each([
      ["different user", OTHER_USER_ID, "BRL", START, END],
      ["different currency", USER_ID, "USD", START, END],
      ["different period", USER_ID, "BRL", new Date("2026-06-01T00:00:00.000Z"), END]
    ])("keeps %s in an independent fingerprint scope", async (_label, userId, currency, start, end) => {
      await service.generate(userId, { startDate: start.toISOString(), endDate: end.toISOString(), currency });
      expect(database.financialInsight.create).toHaveBeenCalledTimes(1);
      expect(database.financialInsight.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId, periodStart: start, periodEnd: end, dataPoints: expect.objectContaining({ currency }) }) });
    });

    it("rejects an invalid range before creating a run", async () => {
      await expect(service.generate(USER_ID, { startDate: END.toISOString(), endDate: START.toISOString() })).rejects.toBeInstanceOf(BadRequestException);
      expect(database.insightGenerationRun.create).not.toHaveBeenCalled();
    });

    it("does not audit when creation of the run fails", async () => {
      database.insightGenerationRun.create.mockRejectedValue(new Error("database unavailable"));
      await expect(service.generate(USER_ID, {})).rejects.toThrow("database unavailable");
      expect(auditRecord).not.toHaveBeenCalled();
    });

    it.each(["lookup", "create", "update", "complete"])("rolls back and marks the run failed with a sanitized error when %s fails", async (step) => {
      if (step === "lookup") database.financialInsight.findFirst.mockRejectedValue(new Error("postgres://user:password@host/db\nstack"));
      if (step === "create") database.financialInsight.create.mockRejectedValue(new Error("secret token"));
      if (step === "update") { database.financialInsight.findFirst.mockResolvedValue(insight({ severity: FinancialInsightSeverity.WARNING })); database.financialInsight.update.mockRejectedValue(new Error("update failed")); }
      if (step === "complete") database.insightGenerationRun.update.mockRejectedValueOnce(new Error("finish failed")).mockResolvedValue(run({ status: RunStatus.FAILED }));
      await expect(service.generate(USER_ID, {})).rejects.toThrow();
      expect(database.insightGenerationRun.update).toHaveBeenLastCalledWith({ where: { id: RUN_ID }, data: expect.objectContaining({ status: RunStatus.FAILED, errorCode: "GENERATION_FAILED", errorMessage: "Insight generation failed" }) });
      expect(auditRecord).not.toHaveBeenCalled();
    });

    it("retries P2002 as safe deduplication without duplicate audit", async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
      database.financialInsight.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(insight({ title:"Financial insights are ready",body:"Your deterministic insight run completed.",dataPoints: { code: "INSIGHTS_ENGINE_READY", currency: "BRL", fingerprint: FINGERPRINT } }));
      database.financialInsight.create.mockRejectedValueOnce(conflict);
      const result = await service.generate(USER_ID, { startDate: START.toISOString(), endDate: END.toISOString(), currency: "BRL" });
      expect(database.transactionCalls).toHaveLength(2);
      expect(result.summary.skipped).toBe(1);
      expect(auditRecord).toHaveBeenCalledTimes(1);
    });

    it("retries a serializable P2034 write conflict", async () => {
      const conflict = new Prisma.PrismaClientKnownRequestError("write conflict", { code: "P2034", clientVersion: "test" });
      database.financialInsight.findFirst.mockResolvedValue(insight({ title:"Financial insights are ready",body:"Your deterministic insight run completed.",dataPoints: { code: "INSIGHTS_ENGINE_READY", currency: "BRL", fingerprint: FINGERPRINT } }));
      const transaction = jest.spyOn(database, "$transaction").mockRejectedValueOnce(conflict);
      const result = await service.generate(USER_ID, { startDate: START.toISOString(), endDate: END.toISOString(), currency: "BRL" });
      expect(result.summary.skipped).toBe(1);
      expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    });

    it("retries adapter-level transaction write conflicts", async () => {
      const conflict = Object.assign(new Error("TransactionWriteConflict"), { cause: { kind: "TransactionWriteConflict" } });
      database.financialInsight.findFirst.mockResolvedValue(insight({ title:"Financial insights are ready",body:"Your deterministic insight run completed.",dataPoints: { code: "INSIGHTS_ENGINE_READY", currency: "BRL", fingerprint: FINGERPRINT } }));
      const transaction = jest.spyOn(database, "$transaction").mockRejectedValueOnce(conflict);
      await expect(service.generate(USER_ID, { startDate: START.toISOString(), endDate: END.toISOString(), currency: "BRL" })).resolves.toEqual(expect.objectContaining({ summary: expect.objectContaining({ skipped: 1 }) }));
      expect(transaction).toHaveBeenCalledTimes(2);
    });

    it("keeps two concurrent equivalent runs coherent and surfaces no P2002", async () => {
      let stored: FinancialInsight | null = null;
      database.insightGenerationRun.create.mockResolvedValueOnce(run()).mockResolvedValueOnce(run({ id: "00000000-0000-4000-8000-000000000005" }));
      database.financialInsight.findFirst.mockImplementation(() => Promise.resolve(stored));
      database.financialInsight.create.mockImplementation(() => {
        if (stored) return Promise.reject(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }));
        stored = insight({ dataPoints: { code: "INSIGHTS_ENGINE_READY", currency: "BRL", fingerprint: FINGERPRINT } });
        return Promise.resolve(stored);
      });
      const results = await Promise.allSettled([service.generate(USER_ID, { startDate: START.toISOString(), endDate: END.toISOString(), currency: "BRL" }), service.generate(USER_ID, { startDate: START.toISOString(), endDate: END.toISOString(), currency: "BRL" })]);
      expect(results.every((result) => result.status === "fulfilled")).toBe(true);
      expect(stored).not.toBeNull();
      expect(auditRecord).toHaveBeenCalledTimes(2);
    });
  });

  describe("queries and lifecycle commands", () => {
    it("lists with default pagination, stable ordering, total and sanitized response", async () => {
      database.financialInsight.findMany.mockResolvedValue([insight()]);
      database.financialInsight.count.mockResolvedValue(21);
      const result = await service.list(USER_ID, {});
      expect(database.financialInsight.findMany).toHaveBeenCalledWith({ where: expect.objectContaining({ userId: USER_ID }), orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: 0, take: 20 });
      expect(result.meta).toEqual({ page: 1, pageSize: 20, total: 21, totalPages: 2 });
      expect(result.data[0]).not.toHaveProperty("userId"); expect(result.data[0]).not.toHaveProperty("fingerprint"); expect(result.data[0]).not.toHaveProperty("deletedAt");
    });

    it("applies every supported list filter scoped to the user", async () => {
      database.financialInsight.findMany.mockResolvedValue([]); database.financialInsight.count.mockResolvedValue(0);
      await service.list(USER_ID, { page: 2, pageSize: 5, currency: "BRL", code: "CODE", type: FinancialInsightType.BUDGET_RISK, severity: FinancialInsightSeverity.WARNING, status: FinancialInsightStatus.SEEN, source: FinancialInsightSource.RULE_ENGINE, isRead: true, startDate: START.toISOString(), endDate: END.toISOString() });
      expect(database.financialInsight.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: USER_ID, type: FinancialInsightType.BUDGET_RISK, severity: FinancialInsightSeverity.WARNING, status: FinancialInsightStatus.SEEN, source: FinancialInsightSource.RULE_ENGINE, periodStart: { gte: START }, periodEnd: { lte: END }, AND: expect.arrayContaining([{ dataPoints: { path: ["currency"], equals: "BRL" } }, { dataPoints: { path: ["code"], equals: "CODE" } }]) }), skip: 5, take: 5 }));
    });

    it("applies requested stable sorting with an id tiebreaker", async () => {
      database.financialInsight.findMany.mockResolvedValue([]); database.financialInsight.count.mockResolvedValue(0);
      await service.list(USER_ID, { sortBy: "periodStart", sortOrder: "asc" });
      expect(database.financialInsight.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ periodStart: "asc" }, { id: "asc" }] }));
    });

    it("normalizes query pagination received from the HTTP runtime", async () => {
      database.financialInsight.findMany.mockResolvedValue([]); database.financialInsight.count.mockResolvedValue(0);
      await service.list(USER_ID, plainToInstance(ListInsightsDto, { page: "1", pageSize: "5", sortBy: "periodStart", sortOrder: "asc" }));
      expect(database.financialInsight.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 5 }));
    });

    it("rejects an inverted listing date range", async () => {
      await expect(service.list(USER_ID, { startDate: END.toISOString(), endDate: START.toISOString() })).rejects.toBeInstanceOf(BadRequestException);
      expect(database.financialInsight.findMany).not.toHaveBeenCalled();
    });

    it.each([[0, 20], [1, 0], [1, 101], [1.5, 20]])("rejects invalid pagination page=%s size=%s", async (page, pageSize) => {
      await expect(service.list(USER_ID, { page, pageSize })).rejects.toBeInstanceOf(BadRequestException);
    });

    it("returns an owned detail and sanitizes internal fields", async () => {
      database.financialInsight.findFirst.mockResolvedValue(insight());
      const result = await service.one(USER_ID, INSIGHT_ID);
      expect(database.financialInsight.findFirst).toHaveBeenCalledWith({ where: { id: INSIGHT_ID, userId: USER_ID } });
      expect(result).not.toHaveProperty("userId"); expect(result.dataPoints).not.toHaveProperty("fingerprint");
    });

    it.each(["detail", "read", "dismiss"])("returns the same safe 404 for absent or third-party %s", async (command) => {
      database.financialInsight.findFirst.mockResolvedValue(null);
      const operation = command === "detail" ? service.one(USER_ID, INSIGHT_ID) : command === "read" ? service.read(USER_ID, INSIGHT_ID) : service.dismiss(USER_ID, INSIGHT_ID);
      await expect(operation).rejects.toBeInstanceOf(NotFoundException);
      expect(database.financialInsight.findFirst).toHaveBeenCalledWith({ where: { id: INSIGHT_ID, userId: USER_ID } });
    });

    it("marks NEW as SEEN once and never dismisses it", async () => {
      database.financialInsight.findFirst.mockResolvedValueOnce(insight()).mockResolvedValueOnce(insight({ status: FinancialInsightStatus.SEEN }));
      database.financialInsight.update.mockResolvedValue(insight({ status: FinancialInsightStatus.SEEN }));
      await service.read(USER_ID, INSIGHT_ID); await service.read(USER_ID, INSIGHT_ID);
      expect(database.financialInsight.update).toHaveBeenCalledTimes(1);
      expect(database.financialInsight.update).toHaveBeenCalledWith({ where: { id: INSIGHT_ID }, data: { status: FinancialInsightStatus.SEEN } });
    });

    it("dismisses once, keeps history, and is idempotent", async () => {
      database.financialInsight.findFirst.mockResolvedValueOnce(insight()).mockResolvedValueOnce(insight({ status: FinancialInsightStatus.DISMISSED }));
      database.financialInsight.update.mockResolvedValue(insight({ status: FinancialInsightStatus.DISMISSED }));
      const first = await service.dismiss(USER_ID, INSIGHT_ID); const second = await service.dismiss(USER_ID, INSIGHT_ID);
      expect(database.financialInsight.update).toHaveBeenCalledTimes(1);
      expect(first.status).toBe(FinancialInsightStatus.DISMISSED); expect(second.id).toBe(INSIGHT_ID);
    });
  });

  describe("metadata security", () => {
    it("removes undefined, secrets, buffers, Prisma objects and full financial payloads deterministically", () => {
      const input = { allowed: "yes", undefinedValue: undefined, token: "secret", password: "secret", connectionString: "postgres://secret", transactions: [{ amount: 10 }], prisma: new Date(), buffer: Buffer.from("secret"), nested: { safe: true } };
      const first = sanitizeInsightMetadata(input); const second = sanitizeInsightMetadata(input);
      expect(first).toEqual({ allowed: "yes", nested: { safe: true } }); expect(second).toEqual(first);
    });

    it("enforces maximum depth and string size", () => {
      const result = sanitizeInsightMetadata({ text: "x".repeat(10_000), a: { b: { c: { d: { e: "too deep" } } } } });
      expect(JSON.stringify(result).length).toBeLessThanOrEqual(4_096); expect(result).toEqual(expect.objectContaining({ a: { b: { c: { d: {} } } } }));
    });

    it("drops non-finite numbers, bigint, Date, Decimal and caps hostile arrays", () => {
      const result = sanitizeInsightMetadata({ nan: Number.NaN, infinity: Number.POSITIVE_INFINITY, bigint: 1n, date: new Date(), decimal: new Prisma.Decimal("1.25"), safe: 12, values: Array.from({ length: 80 }, (_, index) => index) });
      expect(result).toEqual({ safe: 12, values: Array.from({ length: 50 }, (_, index) => index) });
      expect(() => JSON.stringify(result)).not.toThrow();
    });
  });

  describe("detector pipeline",()=>{
    const detection=(currency="BRL",code="PIPELINE_TEST"):DetectedInsight=>({code,type:FinancialInsightType.BUDGET_RISK,severity:FinancialInsightSeverity.WARNING,title:"Detected",message:"Detected safely.",metadata:{currency,amount:"10.00"},currency,periodStart:START,periodEnd:END,relatedEntityType:null,relatedEntityId:null,source:FinancialInsightSource.RULE_ENGINE});
    const detector=(id:string,values:readonly DetectedInsight[])=>({id,supportedTypes:[FinancialInsightType.BUDGET_RISK] as const,detect:jest.fn<ReturnType<InsightDetector["detect"]>,Parameters<InsightDetector["detect"]>>().mockResolvedValue(values)});
    it("builds one shared context per currency and runs selected detectors",async()=>{const build=jest.fn().mockResolvedValue(detectionContext());const currencies=jest.fn().mockResolvedValue(["BRL"]);const selectedDetect=jest.fn<ReturnType<InsightDetector["detect"]>,Parameters<InsightDetector["detect"]>>().mockResolvedValue([detection()]);const ignoredDetect=jest.fn<ReturnType<InsightDetector["detect"]>,Parameters<InsightDetector["detect"]>>().mockResolvedValue([detection("BRL","IGNORED")]);service=new InsightsService(database,{record:auditRecord},{currencies,build},[{id:"BUDGET",supportedTypes:[FinancialInsightType.BUDGET_RISK],detect:selectedDetect},{id:"GOALS",supportedTypes:[FinancialInsightType.GOAL_PROJECTION],detect:ignoredDetect}]);await service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString(),detectors:["BUDGET"]});expect(build).toHaveBeenCalledTimes(1);expect(selectedDetect).toHaveBeenCalledTimes(1);expect(ignoredDetect).not.toHaveBeenCalled()});
    it("processes currencies independently",async()=>{const build=jest.fn().mockImplementation((_userId:string,currency:string)=>Promise.resolve(detectionContext({currency})));const currencies=jest.fn().mockResolvedValue(["BRL","USD"]);const multiDetect:jest.MockedFunction<InsightDetector["detect"]>=jest.fn((value)=>Promise.resolve([detection(value.currency,value.currency)]));const multi:InsightDetector={id:"BUDGET",supportedTypes:[FinancialInsightType.BUDGET_RISK],detect:multiDetect};service=new InsightsService(database,{record:auditRecord},{currencies,build},[multi]);await service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString()});expect(build).toHaveBeenCalledTimes(2);expect(database.financialInsight.create).toHaveBeenCalledTimes(2)});
    it("completes an empty detector result without inventing an insight",async()=>{service=new InsightsService(database,{record:auditRecord},{currencies:jest.fn().mockResolvedValue(["BRL"]),build:jest.fn().mockResolvedValue(detectionContext())},[detector("BUDGET",[])]);const result=await service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString()});expect(result.insight).toBeNull();expect(result.summary).toEqual({created:0,updated:0,skipped:0,resolved:0,reactivated:0});expect(auditRecord).not.toHaveBeenCalled()});
    it("fails the run atomically when a detector fails",async()=>{const broken:InsightDetector={id:"BUDGET",supportedTypes:[FinancialInsightType.BUDGET_RISK],detect:jest.fn().mockRejectedValue(new Error("detector failure"))};service=new InsightsService(database,{record:auditRecord},{currencies:jest.fn().mockResolvedValue(["BRL"]),build:jest.fn().mockResolvedValue(detectionContext())},[broken]);await expect(service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString()})).rejects.toThrow("detector failure");expect(database.financialInsight.create).not.toHaveBeenCalled();expect(auditRecord).not.toHaveBeenCalled();expect(database.insightGenerationRun.update).toHaveBeenLastCalledWith({where:{id:RUN_ID},data:expect.objectContaining({status:RunStatus.FAILED})})});
    it("archives an active condition absent from an executed detector scope",async()=>{const active=insight({status:FinancialInsightStatus.SEEN,dataPoints:{code:"BUDGET_EXCEEDED",currency:"BRL",fingerprint:"old"}});database.financialInsight.findMany.mockResolvedValue([active]);database.financialInsight.update.mockResolvedValue(insight({status:FinancialInsightStatus.ARCHIVED}));service=new InsightsService(database,{record:auditRecord},{currencies:jest.fn().mockResolvedValue(["BRL"]),build:jest.fn().mockResolvedValue(detectionContext())},[detector("BUDGET",[])]);const result=await service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString()});expect(result.summary.resolved).toBe(1);expect(database.financialInsight.update).toHaveBeenCalledWith({where:{id:INSIGHT_ID},data:expect.objectContaining({status:FinancialInsightStatus.ARCHIVED,dataPoints:expect.objectContaining({lifecyclePreviousStatus:FinancialInsightStatus.SEEN,lifecycleResolvedAt:expect.any(String)})})})});
    it("reactivates an archived condition and restores prior read state",async()=>{database.financialInsight.findFirst.mockResolvedValue(insight({status:FinancialInsightStatus.ARCHIVED,dataPoints:{code:"PIPELINE_TEST",currency:"BRL",fingerprint:"stored",lifecyclePreviousStatus:FinancialInsightStatus.SEEN}}));database.financialInsight.update.mockResolvedValue(insight({status:FinancialInsightStatus.SEEN}));service=new InsightsService(database,{record:auditRecord},{currencies:jest.fn().mockResolvedValue(["BRL"]),build:jest.fn().mockResolvedValue(detectionContext())},[detector("BUDGET",[detection()])]);const result=await service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString()});expect(result.summary.reactivated).toBe(1);expect(database.financialInsight.update).toHaveBeenCalledWith({where:{id:INSIGHT_ID},data:expect.objectContaining({status:FinancialInsightStatus.SEEN})})});
    it("reactivates an archived NEW condition as NEW and removes lifecycle metadata",async()=>{database.financialInsight.findFirst.mockResolvedValue(insight({status:FinancialInsightStatus.ARCHIVED,dataPoints:{code:"PIPELINE_TEST",currency:"BRL",fingerprint:"stored",lifecyclePreviousStatus:FinancialInsightStatus.NEW,lifecycleResolvedAt:"2026-01-01"}}));database.financialInsight.update.mockResolvedValue(insight({status:FinancialInsightStatus.NEW,dataPoints:{code:"PIPELINE_TEST",currency:"BRL",amount:"10.00"}}));service=new InsightsService(database,{record:auditRecord},{currencies:jest.fn().mockResolvedValue(["BRL"]),build:jest.fn().mockResolvedValue(detectionContext())},[detector("BUDGET",[detection()])]);const result=await service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString()});expect(result.insights[0]?.status).toBe(FinancialInsightStatus.NEW);expect(result.insights[0]?.dataPoints).not.toHaveProperty("lifecycleResolvedAt")});
    it("keeps a dismissed matching condition dismissed",async()=>{const fingerprint=insightFingerprint({userId:USER_ID,code:"PIPELINE_TEST",currency:"BRL",periodKey:"2026-07-01:2026-07-31",relatedEntityType:null,relatedEntityId:null});database.financialInsight.findFirst.mockResolvedValue(insight({type:FinancialInsightType.BUDGET_RISK,title:"Detected",body:"Detected safely.",severity:FinancialInsightSeverity.WARNING,status:FinancialInsightStatus.DISMISSED,dataPoints:{amount:"10.00",code:"PIPELINE_TEST",currency:"BRL",fingerprint}}));service=new InsightsService(database,{record:auditRecord},{currencies:jest.fn().mockResolvedValue(["BRL"]),build:jest.fn().mockResolvedValue(detectionContext())},[detector("BUDGET",[detection()])]);const result=await service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString()});expect(result.insights[0]?.status).toBe(FinancialInsightStatus.DISMISSED);expect(database.financialInsight.update).not.toHaveBeenCalled()});
    it("never treats dismissed as automatically resolved",async()=>{
      service=new InsightsService(database,{record:auditRecord},{currencies:jest.fn().mockResolvedValue(["BRL"]),build:jest.fn().mockResolvedValue(detectionContext())},[detector("BUDGET",[])]);
      await service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString()});
      expect(database.financialInsight.findMany).toHaveBeenCalledWith({where:expect.objectContaining({status:{in:[FinancialInsightStatus.NEW,FinancialInsightStatus.SEEN]}})});
    });
    it("scopes resolution by user currency period source and executed codes",async()=>{
      service=new InsightsService(database,{record:auditRecord},{currencies:jest.fn().mockResolvedValue(["USD"]),build:jest.fn().mockResolvedValue(detectionContext({currency:"USD"}))},[detector("BUDGET",[])]);
      await service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString(),currency:"USD"});
      expect(database.financialInsight.findMany).toHaveBeenCalledWith({where:expect.objectContaining({userId:USER_ID,source:FinancialInsightSource.RULE_ENGINE,periodStart:START,periodEnd:END,AND:expect.arrayContaining([{OR:[{dataPoints:{path:["currency"],equals:"USD"}}]}])})});
    });
    it("rolls back lifecycle resolution failure and does not audit",async()=>{database.financialInsight.findMany.mockResolvedValue([insight({dataPoints:{code:"BUDGET_EXCEEDED",currency:"BRL",fingerprint:"old"}})]);database.financialInsight.update.mockRejectedValueOnce(new Error("resolution failed")).mockResolvedValue(insight());service=new InsightsService(database,{record:auditRecord},{currencies:jest.fn().mockResolvedValue(["BRL"]),build:jest.fn().mockResolvedValue(detectionContext())},[detector("BUDGET",[])]);await expect(service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString()})).rejects.toThrow("resolution failed");expect(auditRecord).not.toHaveBeenCalled();expect(database.insightGenerationRun.update).toHaveBeenLastCalledWith({where:{id:RUN_ID},data:expect.objectContaining({status:RunStatus.FAILED})})});
    it("does not resolve unseen matches when detector output reaches the safety cap",async()=>{const values=Array.from({length:51},(_,index)=>detection("BRL",`BUDGET_${index}`));service=new InsightsService(database,{record:auditRecord},{currencies:jest.fn().mockResolvedValue(["BRL"]),build:jest.fn().mockResolvedValue(detectionContext())},[detector("BUDGET",values)]);await service.generate(USER_ID,{startDate:START.toISOString(),endDate:END.toISOString()});expect(database.financialInsight.create).toHaveBeenCalledTimes(50);expect(database.financialInsight.findMany).not.toHaveBeenCalled()});
  });
});
