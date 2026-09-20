import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const privateDir = resolve(root, ".private");
const contentPath = resolve(privateDir, "content.json");
const passwordPath = resolve(privateDir, "password.txt");
const outputPath = resolve(root, "dist", "content.enc.json");
const iterations = 310_000;

await mkdir(privateDir, { recursive: true });

let password;
try {
  password = (await readFile(passwordPath, "utf8")).trim();
} catch {
  password = randomBytes(18).toString("base64url");
  await writeFile(passwordPath, `${password}\n`, { encoding: "utf8", mode: 0o600 });
  console.log("已在本机创建密码文件；密码不会写入发布目录。");
}

if (password.length < 12) {
  throw new Error("密码至少需要 12 个字符；建议使用 16 个以上随机字符。 ");
}

const plaintext = await readFile(contentPath);
JSON.parse(plaintext.toString("utf8"));

const salt = randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const cipher = createCipheriv("aes-256-gcm", key, iv);
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const tag = cipher.getAuthTag();

const payload = {
  version: 1,
  algorithm: "AES-GCM",
  kdf: "PBKDF2-SHA-256",
  iterations,
  salt: salt.toString("base64"),
  iv: iv.toString("base64"),
  data: Buffer.concat([ciphertext, tag]).toString("base64")
};

await writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");
console.log("加密内容已更新，可以安全发布 dist 文件夹。");
