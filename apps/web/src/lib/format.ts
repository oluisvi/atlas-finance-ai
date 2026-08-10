export function formatMoney(value: string | null | undefined, currency = "BRL", locale = "pt-BR") {
  if (!value || !/^-?\d+(\.\d+)?$/.test(value)) return "—";
  const negative = value.startsWith("-"); const clean = negative ? value.slice(1) : value;
  const [whole, decimals = ""] = clean.split(".");
  const safe = Number(`${whole}.${decimals.slice(0, 2).padEnd(2, "0")}`);
  return new Intl.NumberFormat(locale,{style:"currency",currency}).format(negative ? -safe : safe);
}
export function normalizeMoneyInput(input: string) {
  const value=input.trim();
  if (!value || /[eE+-]/.test(value)) throw new Error("Informe um valor decimal válido.");
  const compact=value.replace(/\s/g,""); const comma=compact.lastIndexOf(","); const dot=compact.lastIndexOf(".");
  let normalized: string;
  if(comma>dot) normalized=compact.replace(/\./g,"").replace(",",".");
  else if(dot>comma && comma>=0) normalized=compact.replace(/,/g,"");
  else if(comma>=0) normalized=compact.replace(",","."); else normalized=compact;
  if(!/^\d+(\.\d{1,4})?$/.test(normalized)) throw new Error("Use até quatro casas decimais.");
  const [w="0",d=""]=normalized.split("."); return `${w.replace(/^0+(?=\d)/,"")||"0"}.${d.padEnd(4,"0")}`;
}
export function formatDate(value?:string){ if(!value)return "—"; const date=value.slice(0,10).split("-"); return date.length===3?`${date[2]}/${date[1]}/${date[0]}`:value; }
