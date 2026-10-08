// Gera ../hub-verbas.zip só com o necessário para o deploy (sem segredos, node_modules, .next, lockfile).
import { existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const alvo = "../hub-verbas.zip";
const itens = [
  "src", "public", "package.json", "next.config.mjs", "tsconfig.json",
  "postcss.config.mjs", "next-env.d.ts", ".env.example", ".gitignore",
].filter((i) => existsSync(i));

if (existsSync(alvo)) rmSync(alvo);
execFileSync("tar", ["-a", "-c", "-f", alvo, ...itens], { stdio: "inherit" });
console.log(`Gerado ${alvo} com: ${itens.join(", ")}`);
