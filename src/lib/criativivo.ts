import type { Cliente } from "@/lib/tipos";

export type Conta = { nome: string; id: string; liquido: number | null; bruto: number | null };

/** Normaliza para comparar nomes: sem acento, sem "CA - ", minúsculo, só letras/números. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\s*ca\s*-\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "R$ 1.234,56", "-R$ 0,02", "R$ -0,02", "833,92" → número (aceita negativo). */
export function lerMoeda(txt: string): number | null {
  const negativo = /-/.test(txt);
  const s = txt.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const limpo = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s;
  const n = Number(limpo);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

const VALOR = String.raw`(-?\s*R\$\s*-?\s*[\d.,]+)`;
const RE_SALDO = new RegExp(String.raw`Saldo\s+dispon[ií]vel\s*:?\s*${VALOR}(?:\s*\(\s*Bruto\s*:?\s*${VALOR}\s*\))?`, "i");

/** Extrai as contas do texto colado. Cada conta é ancorada na linha "ID: …"; o nome é a linha anterior. */
export function extrairContas(texto: string): Conta[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim());
  const idx: number[] = [];
  linhas.forEach((l, i) => {
    if (/^ID\s*:\s*\d+/i.test(l)) idx.push(i);
  });
  return idx.map((i, k) => {
    let j = i - 1;
    while (j >= 0 && !linhas[j]) j--;
    const nome = (j >= 0 ? linhas[j] : "").replace(/^\s*CA\s*-\s*/i, "").trim();
    const fim = k + 1 < idx.length ? idx[k + 1] : linhas.length;
    const trecho = linhas.slice(i, fim).join("\n");
    const m = trecho.match(RE_SALDO);
    return {
      nome,
      id: linhas[i].match(/\d+/)![0],
      liquido: m ? lerMoeda(m[1]) : null,
      bruto: m && m[2] ? lerMoeda(m[2]) : null,
    };
  });
}

/** Cliente correspondente: vínculo salvo, nome igual ou, se houver um único candidato, nome parcial. */
export function casarCliente(conta: Conta, clientes: Cliente[], vinculos: Record<string, string>): string | null {
  const chave = normalizar(conta.nome);
  const salvo = vinculos[chave];
  if (salvo && clientes.some((c) => c.taskId === salvo)) return salvo;
  if (!chave) return null;
  const exatos = clientes.filter((c) => normalizar(c.nome) === chave);
  if (exatos.length === 1) return exatos[0].taskId;
  if (exatos.length > 1) return null;
  const parciais = clientes.filter((c) => {
    const n = normalizar(c.nome);
    return n && (n.includes(chave) || chave.includes(n));
  });
  return parciais.length === 1 ? parciais[0].taskId : null;
}
