import assert from "node:assert/strict";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const privateDir = resolve(root, ".private");
const password = (await readFile(resolve(privateDir, "password.txt"), "utf8")).trim();
// 与具体内容相关的检查项放在 .private 中：本脚本在公开仓库里，不能出现私人文字。
const expectations = JSON.parse(await readFile(resolve(privateDir, "verify-expectations.json"), "utf8"));

async function decryptFile(path) {
  const payload = JSON.parse(await readFile(path, "utf8"));
  const encrypted = Buffer.from(payload.data, "base64");
  const ciphertext = encrypted.subarray(0, -16);
  const tag = encrypted.subarray(-16);
  const key = pbkdf2Sync(password, Buffer.from(payload.salt, "base64"), payload.iterations, 32, "sha256");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(tag);

  try {
    return {
      payload,
      plaintext: Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
    };
  } catch {
    throw new Error(`无法用 .private/password.txt 解密 ${relative(root, path)}。密码文件可能在上次构建后被改过，请确认线上应使用的密码，再运行 node scripts/build-private.mjs。`);
  }
}

const homepage = await decryptFile(resolve(root, "dist", "content.enc.json"));
const content = JSON.parse(homepage.plaintext);
const loveProject = await decryptFile(resolve(root, "dist", "projects", "love", "content.enc.json"));
const lettersProject = await decryptFile(resolve(root, "dist", "projects", "letters", "content.enc.json"));
const loveProjectShell = await readFile(resolve(root, "dist", "projects", "love", "index.html"), "utf8");
const lettersProjectShell = await readFile(resolve(root, "dist", "projects", "letters", "index.html"), "utf8");

assert.equal(homepage.payload.algorithm, "AES-GCM");
assert.ok(homepage.payload.iterations >= 300_000);
assert.equal(content.people.length, 2);
assert.ok(content.stories.length >= 1);
assert.equal(content.projects.length, 2);
content.projects.forEach((project) => assert.match(project.url, /^https:\/\//));
expectations.loveContains.forEach((term) => assert.ok(loveProject.plaintext.includes(term), "Love 项目缺少预期内容"));
assert.equal(loveProject.payload.algorithm, "AES-GCM");
assert.ok(loveProject.payload.iterations >= 300_000);
assert.match(loveProjectShell, /script-src[^;]*'wasm-unsafe-eval'/);
expectations.lettersContains.forEach((term) => assert.ok(lettersProject.plaintext.includes(term), "信件项目缺少预期内容"));
expectations.lettersExcludes.forEach((term) => assert.ok(!lettersProject.plaintext.includes(term), "信件项目包含已移除的内容"));
assert.equal((lettersProject.plaintext.match(/\n\s+title: "/g) || []).length, expectations.letterCount);
assert.equal(lettersProject.payload.algorithm, "AES-GCM");
assert.ok(lettersProject.payload.iterations >= 300_000);
assert.match(lettersProjectShell, /script-src[^;]*'unsafe-inline'/);

const privateTerms = [
  content.siteTitle,
  ...content.people.flatMap((person) => [person.name, person.city]),
  ...content.stories.flatMap((story) => [story.title, story.text]),
  ...content.projects.flatMap((project) => [project.name, project.description]),
  ...expectations.loveContains,
  ...expectations.lettersContains,
  ...expectations.extraPrivateTerms
];
const listFiles = async (directory) => (await readdir(resolve(root, directory), { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== "content.enc.json")
  .map((entry) => resolve(entry.parentPath, entry.name));
// scripts 和 README 虽不发布到 Pages，但同样在公开仓库里。
const readAll = async (paths) => (await Promise.all(paths.map((path) => readFile(path, "utf8")))).join("\n");
const distText = await readAll(await listFiles("dist"));
const repoText = await readAll([...await listFiles("scripts"), resolve(root, "README.md")]);

for (const term of privateTerms) {
  assert.ok(!distText.includes(term) && !repoText.includes(term), `公开文件中发现私人明文：${term}`);
}
assert.ok(!distText.includes('minlength="12"'), "发布文件仍包含密码长度限制");

console.log("验证通过：主页与项目密文可解密，公开文件未发现指定私人明文。");
