import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "hv_sessao";
const DURACAO_S = 8 * 60 * 60;

// A chave de assinatura deriva da APP_PASSWORD: trocar a senha encerra todas as sessões.
const assinar = (exp: string, senha: string) =>
  createHmac("sha256", createHmac("sha256", "hub-verbas-sessao").update(senha).digest()).update(exp).digest("base64url");

const iguais = (a: string, b: string) => {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
};

export const senhaCorreta = (digitada: string, senha: string) => iguais(digitada, senha);

export async function criarSessao(senha: string) {
  const exp = String(Math.floor(Date.now() / 1000) + DURACAO_S);
  (await cookies()).set(COOKIE, `${exp}.${assinar(exp, senha)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_S,
  });
}

export async function sessaoValida(senha: string): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return iguais(sig, assinar(exp, senha));
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE);
}
