const form = document.querySelector("#unlock-form");
const passwordInput = document.querySelector("#password");
const revealButton = document.querySelector("#reveal");
const unlockButton = document.querySelector("#unlock");
const status = document.querySelector("#status");

function decodeBase64(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function decryptProject(password) {
  const response = await fetch("./content.enc.json", { cache: "no-store" });
  if (!response.ok) throw new Error("项目文件加载失败，请稍后重试。");

  const payload = await response.json();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: decodeBase64(payload.salt),
      iterations: payload.iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(payload.iv) },
    key,
    decodeBase64(payload.data)
  );

  return new TextDecoder().decode(plaintext);
}

revealButton.addEventListener("click", () => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  revealButton.textContent = showing ? "显示" : "隐藏";
  revealButton.setAttribute("aria-pressed", String(!showing));
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  unlockButton.disabled = true;
  status.textContent = "正在解密…";

  try {
    const html = await decryptProject(passwordInput.value);
    const project = new DOMParser().parseFromString(html, "text/html");
    const scripts = [...project.scripts].map((script) => ({
      attributes: [...script.attributes].map(({ name, value }) => [name, value]),
      text: script.textContent
    }));
    project.querySelectorAll("script").forEach((script) => script.remove());

    document.documentElement.lang = project.documentElement.lang;
    document.head.replaceWith(project.head);
    document.body.replaceWith(project.body);

    for (const source of scripts) {
      const script = document.createElement("script");
      source.attributes.forEach(([name, value]) => script.setAttribute(name, value));
      script.textContent = source.text;
      document.body.append(script);
    }
  } catch {
    status.textContent = "密码不正确，或项目文件无法读取。";
    passwordInput.select();
    unlockButton.disabled = false;
  }
});
