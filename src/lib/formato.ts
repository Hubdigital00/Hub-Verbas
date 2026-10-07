const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const moeda = (n: number) => brl.format(n);

/** Converte "1.234,56", "R$ 1.500", "1234.56" em número. Retorna null se inválido. */
export function lerValor(txt: string): number | null {
  let s = String(txt).replace(/R\$|\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const valorPermitido = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100_000_000;
export const arredondar = (n: number) => Math.round(n * 100) / 100;
