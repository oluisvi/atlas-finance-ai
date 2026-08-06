import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { AuditEventType, FinancialInsightSeverity, FinancialInsightSource, FinancialInsightStatus, FinancialInsightType, InsightGenerationTrigger, Prisma, RunStatus, type FinancialInsight } from "@prisma/client";
import { AuditService } from "../audit/audit.service.js";
import type { GenerateInsightsDto, ListInsightsDto } from "./dto/insights.dto.js";
import { INSIGHTS_DATABASE, type InsightsDatabasePort, type InsightsTransactionClient } from "./insights-database.port.js";
import { insightFingerprint } from "./insights.types.js";
import { INSIGHT_DETECTORS, MAX_DETECTION_PERIOD_DAYS, MAX_INSIGHTS_PER_GENERATION } from "./insights.constants.js";
import { InsightContextService } from "./insight-context.service.js";
import type { DetectedInsight, InsightDetector } from "./detectors/insight-detector.interface.js";

const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_LENGTH = 4_096;
const BLOCKED_KEYS = /(token|password|secret|connection|string|balance|transactions?|prisma|payload)/i;

type SafeJson = string | number | boolean | null | SafeJson[] | { [key: string]: SafeJson };

export function sanitizeInsightMetadata(value: unknown, depth = 0): SafeJson | undefined {
  if (value === undefined || depth > MAX_METADATA_DEPTH || Buffer.isBuffer(value)) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, MAX_METADATA_LENGTH);
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeInsightMetadata(item, depth + 1)).filter((item): item is SafeJson => item !== undefined);
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
  const result: { [key: string]: SafeJson } = {};
  for (const [key, item] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    if (BLOCKED_KEYS.test(key)) continue;
    const safe = sanitizeInsightMetadata(item, depth + 1);
    if (safe !== undefined) result[key] = safe;
    if (JSON.stringify(result).length > MAX_METADATA_LENGTH) delete result[key];
  }
  return result;
}

@Injectable()
export class InsightsService {
  constructor(@Inject(INSIGHTS_DATABASE) private readonly database: InsightsDatabasePort, @Inject(AuditService) private readonly audit: Pick<AuditService, "record">, @Optional() @Inject(InsightContextService) private readonly contextService?: Pick<InsightContextService,"currencies"|"build">, @Optional() @Inject(INSIGHT_DETECTORS) private readonly detectors: readonly InsightDetector[] = []) {}

  async list(userId: string, dto: ListInsightsDto) {
    const page = Number(dto.page ?? 1);
    const pageSize = Number(dto.pageSize ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new BadRequestException({ code: "INVALID_PAGINATION", message: "Invalid pagination" });
    const where: Prisma.FinancialInsightWhereInput = {
      userId,
      type: dto.type as FinancialInsightType | undefined,
      severity: dto.severity as FinancialInsightSeverity | undefined,
      status: dto.status as FinancialInsightStatus | undefined,
      source: dto.source as FinancialInsightSource | undefined,
      periodStart: dto.startDate ? { gte: new Date(dto.startDate) } : undefined,
      periodEnd: dto.endDate ? { lte: new Date(dto.endDate) } : undefined,
      AND: [
        dto.currency ? { dataPoints: { path: ["currency"], equals: dto.currency.toUpperCase() } } : {},
        dto.code ? { dataPoints: { path: ["code"], equals: dto.code } } : {},
        dto.isRead === undefined ? {} : { status: dto.isRead ? { in: [FinancialInsightStatus.SEEN, FinancialInsightStatus.DISMISSED, FinancialInsightStatus.ARCHIVED] } : FinancialInsightStatus.NEW }
      ]
    };
    const [data, total] = await this.database.$transaction((transaction) => Promise.all([
      transaction.financialInsight.findMany({ where, orderBy: [{ [dto.sortBy ?? "createdAt"]: dto.sortOrder ?? "desc" }, { id: dto.sortOrder ?? "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      transaction.financialInsight.count({ where })
    ]));
    return { data: data.map((item) => this.present(item)), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async one(userId: string, id: string) {
    return this.present(await this.requireOwned(userId, id));
  }

  async read(userId: string, id: string) {
    const item = await this.requireOwned(userId, id);
    if (item.status !== FinancialInsightStatus.NEW) return this.present(item);
    return this.present(await this.database.financialInsight.update({ where: { id: item.id }, data: { status: FinancialInsightStatus.SEEN } }));
  }

  async dismiss(userId: string, id: string) {
    const item = await this.requireOwned(userId, id);
    if (item.status === FinancialInsightStatus.DISMISSED) return this.present(item);
    return this.present(await this.database.financialInsight.update({ where: { id: item.id }, data: { status: FinancialInsightStatus.DISMISSED } }));
  }

  async generate(userId: string, dto: GenerateInsightsDto) {
    const now = new Date();
    const start = dto.startDate ? new Date(dto.startDate) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = dto.endDate ? new Date(dto.endDate) : now;
    if (end < start) throw new BadRequestException({ code: "INVALID_DATE_RANGE", message: "Invalid date range" });
    const currency = dto.currency?.toUpperCase() ?? null;
    const run = await this.database.insightGenerationRun.create({ data: { userId, trigger: InsightGenerationTrigger.MANUAL, periodStart: start, periodEnd: end, status: RunStatus.RUNNING, startedAt: now, inputSummary: { currency, origin: FinancialInsightSource.RULE_ENGINE, engine: "deterministic-v1" } } });
    try {
      const detections = await this.detect(userId, dto, start, end, currency);
      const result = await this.persistGeneration(userId, run.id, start, end, currency, detections);
      for (const item of result.items) await this.audit.record({ action: "insights.generate", actorUserId: userId, userId, eventType: AuditEventType.INSIGHT_GENERATED, entityId: item.insight.id, entityType: "financial_insight", metadata: { runId: run.id, outcome: item.outcome, trigger: InsightGenerationTrigger.MANUAL, currency: item.currency, periodStart: start.toISOString(), periodEnd: end.toISOString(), created: item.outcome === "created" ? 1 : 0, updated: item.outcome === "updated" ? 1 : 0, skipped: item.outcome === "skipped" ? 1 : 0 } });
      const first = result.items[0];
      return { runId: run.id, insight: first ? this.present(first.insight) : null, insights: result.items.map(item=>this.present(item.insight)), created: result.summary.created>0, summary: result.summary };
    } catch (error) {
      await this.failRun(run.id, error);
      throw error;
    }
  }

  private async detect(userId:string,dto:GenerateInsightsDto,start:Date,end:Date,currency:string|null):Promise<readonly DetectedInsight[]|null>{if(!this.contextService||this.detectors.length===0)return null;const days=(end.getTime()-start.getTime())/86_400_000;if(days>MAX_DETECTION_PERIOD_DAYS)throw new BadRequestException({code:"DETECTION_PERIOD_TOO_LARGE",message:"Detection period is too large"});const selected=new Set(dto.detectors??this.detectors.map(detector=>detector.id));const active=this.detectors.filter(detector=>selected.has(detector.id));const currencies=await this.contextService.currencies(userId,currency??undefined);const results:DetectedInsight[]=[];for(const currentCurrency of currencies){const context=await this.contextService.build(userId,currentCurrency,{start,end});for(const detector of active)results.push(...await detector.detect(context));}return results.slice(0,MAX_INSIGHTS_PER_GENERATION);}

  private async persistGeneration(userId: string, runId: string, start: Date, end: Date, currency: string | null, detections:readonly DetectedInsight[]|null) {
    try {
      return await this.database.$transaction((transaction) => this.upsertAndComplete(transaction, userId, runId, start, end, currency, detections));
    } catch (error) {
      if (!this.isUniqueConflict(error)) throw error;
      return this.database.$transaction((transaction) => this.upsertAndComplete(transaction, userId, runId, start, end, currency, detections));
    }
  }

  private async upsertAndComplete(transaction: InsightsTransactionClient, userId: string, runId: string, start: Date, end: Date, currency: string | null, detections:readonly DetectedInsight[]|null) {
    const candidates=detections??[{code:"INSIGHTS_ENGINE_READY",type:FinancialInsightType.CASHFLOW_SUMMARY,source:FinancialInsightSource.RULE_ENGINE,severity:FinancialInsightSeverity.INFO,title:"Financial insights are ready",message:"Your deterministic insight run completed.",metadata:{},currency,periodStart:start,periodEnd:end,relatedEntityType:null,relatedEntityId:null}];const items:Array<{insight:FinancialInsight;outcome:"created"|"updated"|"skipped";currency:string|null}>=[];
    for(const candidate of candidates){const fingerprint=insightFingerprint({userId,code:candidate.code,currency:candidate.currency,periodKey:`${candidate.periodStart.toISOString().slice(0,10)}:${candidate.periodEnd.toISOString().slice(0,10)}`,relatedEntityType:candidate.relatedEntityType,relatedEntityId:candidate.relatedEntityId});const dataPoints=sanitizeInsightMetadata({fingerprint,code:candidate.code,currency:candidate.currency,...candidate.metadata}) as Prisma.InputJsonValue;const existing=await transaction.financialInsight.findFirst({where:{userId,type:candidate.type,source:candidate.source,periodStart:candidate.periodStart,periodEnd:candidate.periodEnd,dataPoints:{path:["fingerprint"],equals:fingerprint}}});let insight:FinancialInsight;let outcome:"created"|"updated"|"skipped";if(!existing){insight=await transaction.financialInsight.create({data:{userId,type:candidate.type,source:candidate.source,periodStart:candidate.periodStart,periodEnd:candidate.periodEnd,title:candidate.title,body:candidate.message,severity:candidate.severity,status:FinancialInsightStatus.NEW,generatedByRunId:runId,dataPoints}});outcome="created";}else{const changed=JSON.stringify(sanitizeInsightMetadata(existing.dataPoints))!==JSON.stringify(sanitizeInsightMetadata(dataPoints))||existing.severity!==candidate.severity||existing.title!==candidate.title||existing.body!==candidate.message;insight=changed?await transaction.financialInsight.update({where:{id:existing.id},data:{generatedByRunId:runId,severity:candidate.severity,title:candidate.title,body:candidate.message,dataPoints}}):existing;outcome=changed?"updated":"skipped";}items.push({insight,outcome,currency:candidate.currency});}
    const summary={created:items.filter(item=>item.outcome==="created").length,updated:items.filter(item=>item.outcome==="updated").length,skipped:items.filter(item=>item.outcome==="skipped").length};await transaction.insightGenerationRun.update({where:{id:runId},data:{status:RunStatus.COMPLETED,finishedAt:new Date(),tokenInputCount:0,tokenOutputCount:0,inputSummary:{currency,origin:FinancialInsightSource.RULE_ENGINE,engine:"deterministic-v2",...summary}}});return {items,summary};
  }

  private async failRun(runId: string, error: unknown): Promise<void> {
    const code = this.isUniqueConflict(error) ? "CONCURRENT_CONFLICT" : "GENERATION_FAILED";
    try { await this.database.insightGenerationRun.update({ where: { id: runId }, data: { status: RunStatus.FAILED, finishedAt: new Date(), errorCode: code, errorMessage: "Insight generation failed" } }); } catch { /* The original error remains authoritative. */ }
  }

  private isUniqueConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" || (typeof error === "object" && error !== null && "code" in error && error.code === "P2002");
  }

  private async requireOwned(userId: string, id: string): Promise<FinancialInsight> {
    const item = await this.database.financialInsight.findFirst({ where: { id, userId } });
    if (!item) throw new NotFoundException({ code: "INSIGHT_NOT_FOUND", message: "Insight not found" });
    return item;
  }

  private present(item: FinancialInsight) {
    const safe = sanitizeInsightMetadata(item.dataPoints);
    const dataPoints = typeof safe === "object" && safe !== null && !Array.isArray(safe) ? Object.fromEntries(Object.entries(safe).filter(([key]) => key !== "fingerprint")) : safe;
    return { id: item.id, type: item.type, source: item.source, periodStart: item.periodStart, periodEnd: item.periodEnd, title: item.title, body: item.body, severity: item.severity, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt, dataPoints };
  }
}
