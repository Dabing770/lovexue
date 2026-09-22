import assert from "node:assert/strict";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const password = (await readFile(resolve(root, ".private", "password.txt"), "utf8")).trim();
async function decryptFile(path) {
  const payload = JSON.parse(await readFile(path, "utf8"));
  const encrypted = Buffer.from(payload.data, "base64");
  const ciphertext = encrypted.subarray(0, -16);
  const tag = encrypted.subarray(-16);
  const key = pbkdf2Sync(password, Buffer.from(payload.salt, "base64"), payload.iterations, 32, "sha256");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(tag);

  return {
    payload,
    plaintext: Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
  };
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
assert.match(loveProject.plaintext, /<title>Love Memories · 爱的回忆<\/title>/);
assert.equal(loveProject.payload.algorithm, "AES-GCM");
assert.ok(loveProject.payload.iterations >= 300_000);
assert.match(loveProjectShell, /script-src[^;]*'wasm-unsafe-eval'/);
assert.match(lettersProject.plaintext, /<title>见字如面 · 写给雪儿的信<\/title>/);
assert.match(lettersProject.plaintext, /亲爱的雪儿，见字如面。/);
assert.match(lettersProject.plaintext, /不管将来什么时候再读这封信/);
assert.match(lettersProject.plaintext, /OvO 还没想好写什么呢/);
assert.doesNotMatch(lettersProject.plaintext, /写给你的九封信/);
assert.equal((lettersProject.plaintext.match(/\n\s+title: "/g) || []).length, 2);
assert.equal(lettersProject.payload.algorithm, "AES-GCM");
assert.ok(lettersProject.payload.iterations >= 300_000);
assert.match(lettersProjectShell, /script-src[^;]*'unsafe-inline'/);

const privateTerms = [
  content.siteTitle,
  ...content.people.flatMap((person) => [person.name, person.city]),
  ...content.stories.flatMap((story) => [story.title, story.text]),
  ...content.projects.flatMap((project) => [project.name, project.description]),
  "<h1>Our Love</h1>",
  "亲爱的雪儿，见字如面。",
  "不管将来什么时候再读这封信",
  "OvO 还没想好写什么呢"
];
const publicFiles = (await readdir(resolve(root, "dist"), { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== "content.enc.json")
  .map((entry) => resolve(entry.parentPath, entry.name));
const publicText = (
  await Promise.all(publicFiles.map((path) => readFile(path, "utf8")))
).join("\n");

for (const term of privateTerms) {
  assert.ok(!publicText.includes(term), `发布文件中发现私人明文：${term}`);
}
assert.doesNotMatch(publicText, /minlength="12"/);

console.log("验证通过：主页与项目密文可解密，发布文件未发现指定私人明文。");
