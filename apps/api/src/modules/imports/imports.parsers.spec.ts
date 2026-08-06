import { Prisma } from "@prisma/client";
import { importFingerprint, parseCsv, parseOfx } from "./imports.parsers.js";
describe("import parsers",()=>{
 it.each([",",";","\t"])("parses CSV delimiter %s",delimiter=>{const rows=parseCsv(`date${delimiter}description${delimiter}amount\n2026-08-01${delimiter}Coffee${delimiter}-20.50`);expect(rows[0]).toMatchObject({type:"EXPENSE",description:"Coffee"});expect(rows[0]?.amount.toString()).toBe("20.5");});
 it("supports BOM and produces deterministic fingerprints",()=>{const rows=parseCsv("\uFEFFdate,description,amount\n2026-08-01, Coffee   Shop ,10");expect(rows[0]?.fingerprint).toBe(importFingerprint("coffee shop",new Prisma.Decimal("10"),new Date("2026-08-01"),null));});
  it.each(["date,description,amount\n","date,description,amount\n2026-08-01,Coffee,1e2","date,description,amount\ninvalid,Coffee,10"])("rejects invalid CSV",input=>expect(()=>parseCsv(input)).toThrow());
 it("parses SGML OFX with FITID",()=>{const rows=parseOfx("<OFX><STMTTRN><FITID>abc</FITID><DTPOSTED>20260801<TRNAMT>-9.25<NAME>Coffee</STMTTRN>");expect(rows[0]).toMatchObject({externalId:"abc",type:"EXPENSE"});});
 it.each(["<!DOCTYPE x><OFX>","<OFX>","<STMTTRN><DTPOSTED>bad<TRNAMT>1<NAME>x</STMTTRN>"])("rejects unsafe or malformed OFX",input=>expect(()=>parseOfx(input)).toThrow());
 it("changes fingerprint for a different external id, account-independent row data remains stable",()=>{const date=new Date("2026-08-01");expect(importFingerprint("Coffee",new Prisma.Decimal("10"),date,"a")).not.toBe(importFingerprint("Coffee",new Prisma.Decimal("10"),date,"b"));expect(importFingerprint(" Coffee ",new Prisma.Decimal("10"),date,null)).toBe(importFingerprint("coffee",new Prisma.Decimal("10"),date,null));});
});
