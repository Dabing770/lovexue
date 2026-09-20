import assert from "node:assert/strict";
import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const password = (await readFile(resolve(root, ".private", "password.txt"), "utf8")).trim();
const payload = JSON.parse(await readFile(resolve(root, "dist", "content.enc.json"), "utf8"));
const encrypted = Buffer.from(payload.data, "base64");
const ciphertext = encrypted.subarray(0, -16);
const tag = encrypted.subarray(-16);
const key = pbkdf2Sync(password, Buffer.from(payload.salt, "base64"), payload.iterations, 32, "sha256");
const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
decipher.setAuthTag(tag);
const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
const content = JSON.parse(plaintext);

assert.equal(payload.algorithm, "AES-GCM");
assert.ok(payload.iterations >= 300_000);
assert.equal(content.people.length, 2);
assert.ok(content.stories.length >= 1);

const privateTerms = [
  content.siteTitle,
  ...content.people.flatMap((person) => [person.name, person.city]),
  ...content.stories.flatMap((story) => [story.title, story.text])
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

console.log("验证通过：密文可解密，发布文件未发现指定私人明文。");
