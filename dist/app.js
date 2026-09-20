const $ = (selector) => document.querySelector(selector);

const unlock = $("#unlock");
const site = $("#site");
const form = $("#unlock-form");
const passwordInput = $("#password");
const status = $("#form-status");
const submitButton = form.querySelector('button[type="submit"]');
let timerId;
let globeCleanup;

const fromBase64 = (value) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function decryptContent(password) {
  const response = await fetch("./content.enc.json", { cache: "no-store" });
  if (!response.ok) throw new Error("内容暂时无法读取，请稍后再试。");

  const payload = await response.json();
  if (payload.version !== 1 || payload.algorithm !== "AES-GCM") {
    throw new Error("加密内容版本不受支持。");
  }

  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: fromBase64(payload.salt),
      iterations: payload.iterations,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.iv) },
    key,
    fromBase64(payload.data)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  status.textContent = "正在解锁…";
  status.style.color = "var(--muted)";
  submitButton.disabled = true;

  try {
    const content = await decryptContent(passwordInput.value);
    renderSite(content);
    passwordInput.value = "";
    unlock.hidden = true;
    site.hidden = false;
    window.scrollTo({ top: 0 });
  } catch (error) {
    const isPasswordError = error?.name === "OperationError";
    status.textContent = isPasswordError ? "密码不正确，请重新输入。" : error.message;
    status.style.color = "var(--danger)";
    passwordInput.select();
  } finally {
    submitButton.disabled = false;
  }
});

$("#reveal-password").addEventListener("click", (event) => {
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  event.currentTarget.textContent = showing ? "显示" : "隐藏";
  event.currentTarget.setAttribute("aria-pressed", String(!showing));
  event.currentTarget.setAttribute("aria-label", showing ? "显示密码" : "隐藏密码");
  passwordInput.focus();
});

$("#lock-site").addEventListener("click", () => {
  clearInterval(timerId);
  globeCleanup?.();
  site.hidden = true;
  unlock.hidden = false;
  status.textContent = "";
  passwordInput.focus();
  window.scrollTo({ top: 0 });
});

function renderSite(content) {
  document.title = content.siteTitle;
  $("#brand").textContent = content.siteTitle;
  $("#hero-eyebrow").textContent = content.eyebrow;
  $("#hero-title").textContent = content.headline;
  $("#hero-message").textContent = content.message;
  $("#timer-label").textContent = content.relationship.label;
  $("#footer-title").textContent = content.siteTitle;

  renderTimer(content.relationship.start, content.relationship.label);
  renderLocations(content.people);
  renderStories(content.stories);
  renderProjects(content.projects);
  globeCleanup = createGlobe($("#globe"), content.people);
}

function renderTimer(startValue, relationshipLabel) {
  const start = new Date(startValue);
  const startText = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(start);
  $("#timer-start").textContent = `始于 ${startText}（芬兰时间）`;

  const update = () => {
    const difference = Date.now() - start.getTime();
    const remaining = Math.abs(difference);
    const totalSeconds = Math.floor(remaining / 1000);
    $("#timer-label").textContent = difference >= 0 ? `${relationshipLabel}，已经` : `距离${relationshipLabel}，还有`;
    $("#days").textContent = Math.floor(totalSeconds / 86400).toLocaleString("zh-CN");
    $("#hours").textContent = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
    $("#minutes").textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    $("#seconds").textContent = String(totalSeconds % 60).padStart(2, "0");
  };

  clearInterval(timerId);
  update();
  timerId = window.setInterval(update, 1000);
}

function renderLocations(people) {
  const list = $("#location-list");
  list.replaceChildren();
  people.forEach((person) => {
    const card = document.createElement("div");
    card.className = "location-card";
    card.style.setProperty("--pin", person.color);
    const dot = document.createElement("span");
    dot.className = "location-dot";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    const location = document.createElement("span");
    name.textContent = person.name;
    location.textContent = `${person.city} · ${person.country}`;
    copy.append(name, location);
    card.append(dot, copy);
    list.append(card);
  });

  if (people.length >= 2) {
    const distance = haversineDistance(people[0], people[1]);
    $("#distance").textContent = `${Math.round(distance).toLocaleString("zh-CN")} km`;
  }
}

function renderStories(stories) {
  const timeline = $("#timeline");
  timeline.replaceChildren();
  stories.forEach((story) => {
    const article = document.createElement("article");
    article.className = "story-card";
    const time = document.createElement("time");
    time.dateTime = story.date;
    time.textContent = story.date.replaceAll("-", ".");
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    const text = document.createElement("p");
    title.textContent = story.title;
    text.textContent = story.text;
    copy.append(title, text);
    article.append(time, copy);
    timeline.append(article);
  });
}

function renderProjects(projects) {
  const grid = $("#projects-grid");
  grid.replaceChildren();

  if (!projects.length) {
    const empty = document.createElement("div");
    empty.className = "projects-empty";
    const copy = document.createElement("div");
    const star = document.createElement("span");
    const text = document.createElement("p");
    star.className = "empty-star";
    star.textContent = "✦";
    star.setAttribute("aria-hidden", "true");
    text.textContent = "未来的作品，会在这里一颗颗亮起。";
    copy.append(star, text);
    empty.append(copy);
    grid.append(empty);
    return;
  }

  projects.forEach((project, index) => {
    const article = document.createElement("article");
    article.className = "project-card";
    const number = document.createElement("span");
    const title = document.createElement("h3");
    const description = document.createElement("p");
    number.className = "project-number";
    number.textContent = String(index + 1).padStart(2, "0");
    title.textContent = project.name;
    description.textContent = project.description;
    article.append(number, title, description);

    if (project.url && /^https?:\/\//i.test(project.url)) {
      const link = document.createElement("a");
      link.href = project.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "打开项目 ↗";
      article.append(link);
    }
    grid.append(article);
  });
}

function haversineDistance(first, second) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const radius = 6371;
  const lat1 = toRadians(first.latitude);
  const lat2 = toRadians(second.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = toRadians(second.longitude - first.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function createGlobe(canvas, people) {
  const context = canvas.getContext("2d");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const midpointLon = people.reduce((sum, person) => sum + person.longitude, 0) / people.length;
  const midpointLat = people.reduce((sum, person) => sum + person.latitude, 0) / people.length;
  let centerLon = toRadians(midpointLon);
  let centerLat = toRadians(midpointLat);
  let width = 0;
  let height = 0;
  let radius = 0;
  let frame;
  let dragging = false;
  let pointerX = 0;
  let pointerY = 0;
  let moved = false;

  const resize = () => {
    const rectangle = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    width = rectangle.width;
    height = rectangle.height;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    radius = Math.min(width, height) * 0.34;
    if (reducedMotion) draw(performance.now());
  };

  const rotate = (vector, drift = 0) => {
    const longitude = centerLon + drift;
    const cosLon = Math.cos(longitude);
    const sinLon = Math.sin(longitude);
    const x = vector.x * cosLon - vector.z * sinLon;
    const z = vector.x * sinLon + vector.z * cosLon;
    const cosLat = Math.cos(centerLat);
    const sinLat = Math.sin(centerLat);
    return {
      x,
      y: vector.y * cosLat - z * sinLat,
      z: vector.y * sinLat + z * cosLat
    };
  };

  const vectorFromCoordinates = (latitude, longitude, scale = 1) => {
    const lat = toRadians(latitude);
    const lon = toRadians(longitude);
    const cosLat = Math.cos(lat) * scale;
    return { x: cosLat * Math.sin(lon), y: Math.sin(lat) * scale, z: cosLat * Math.cos(lon) };
  };

  const project = (vector, drift = 0) => {
    const rotated = rotate(vector, drift);
    return {
      x: width / 2 + rotated.x * radius,
      y: height / 2 - rotated.y * radius,
      z: rotated.z
    };
  };

  const drawLine = (points, color, lineWidth, drift = 0) => {
    context.beginPath();
    let drawing = false;
    for (const point of points) {
      const projected = project(point, drift);
      if (projected.z <= 0) {
        drawing = false;
        continue;
      }
      if (!drawing) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
      drawing = true;
    }
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  };

  const drawGrid = (drift) => {
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      const points = [];
      for (let longitude = -180; longitude <= 180; longitude += 3) {
        points.push(vectorFromCoordinates(latitude, longitude));
      }
      drawLine(points, "rgba(127, 203, 255, 0.13)", 0.75, drift);
    }
    for (let longitude = -180; longitude < 180; longitude += 30) {
      const points = [];
      for (let latitude = -90; latitude <= 90; latitude += 3) {
        points.push(vectorFromCoordinates(latitude, longitude));
      }
      drawLine(points, "rgba(127, 203, 255, 0.13)", 0.75, drift);
    }
  };

  const normalized = (vector) => {
    const length = Math.hypot(vector.x, vector.y, vector.z);
    return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
  };

  const routePoints = () => {
    if (people.length < 2) return [];
    const start = normalized(vectorFromCoordinates(people[0].latitude, people[0].longitude));
    const end = normalized(vectorFromCoordinates(people[1].latitude, people[1].longitude));
    const angle = Math.acos(Math.max(-1, Math.min(1, start.x * end.x + start.y * end.y + start.z * end.z)));
    const sine = Math.sin(angle);
    const points = [];
    for (let index = 0; index <= 80; index += 1) {
      const progress = index / 80;
      const a = Math.sin((1 - progress) * angle) / sine;
      const b = Math.sin(progress * angle) / sine;
      const altitude = 1 + 0.12 * Math.sin(Math.PI * progress);
      points.push({
        x: (start.x * a + end.x * b) * altitude,
        y: (start.y * a + end.y * b) * altitude,
        z: (start.z * a + end.z * b) * altitude
      });
    }
    return points;
  };

  const route = routePoints();

  const draw = (time) => {
    if (radius <= 1 || width <= 1 || height <= 1) {
      if (!reducedMotion) frame = requestAnimationFrame(draw);
      return;
    }
    context.clearRect(0, 0, width, height);
    const drift = dragging || reducedMotion ? 0 : Math.sin(time * 0.00018) * 0.055;
    const centerX = width / 2;
    const centerY = height / 2;

    context.save();
    context.shadowColor = "rgba(65, 170, 255, 0.5)";
    context.shadowBlur = 34;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    const ocean = context.createRadialGradient(
      centerX - radius * 0.34,
      centerY - radius * 0.38,
      radius * 0.08,
      centerX,
      centerY,
      radius
    );
    ocean.addColorStop(0, "#326ba3");
    ocean.addColorStop(0.38, "#163c69");
    ocean.addColorStop(0.78, "#0a2143");
    ocean.addColorStop(1, "#030a18");
    context.fillStyle = ocean;
    context.fill();
    context.restore();

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius - 1, 0, Math.PI * 2);
    context.clip();
    drawGrid(drift);

    context.globalCompositeOperation = "screen";
    context.shadowColor = "#ffbf69";
    context.shadowBlur = 16;
    drawLine(route, "rgba(255, 191, 105, 0.84)", 2.2, drift);
    context.restore();

    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.strokeStyle = "rgba(164, 224, 255, 0.34)";
    context.lineWidth = 1.1;
    context.stroke();

    people.forEach((person) => {
      const point = project(vectorFromCoordinates(person.latitude, person.longitude, 1.01), drift);
      if (point.z <= 0) return;
      const pulse = reducedMotion ? 5 : 5 + Math.sin(time * 0.004) * 1.3;
      context.save();
      context.shadowColor = person.color;
      context.shadowBlur = 20;
      context.fillStyle = person.color;
      context.beginPath();
      context.arc(point.x, point.y, pulse, 0, Math.PI * 2);
      context.fill();
      context.restore();

      context.font = '600 12px Inter, "Microsoft YaHei", sans-serif';
      const labelWidth = context.measureText(person.city).width + 18;
      const labelX = Math.max(8, Math.min(width - labelWidth - 8, point.x + 10));
      const labelY = Math.max(22, Math.min(height - 12, point.y - 12));
      context.fillStyle = "rgba(5, 9, 24, 0.82)";
      roundedRectangle(context, labelX, labelY - 17, labelWidth, 24, 8);
      context.fill();
      context.fillStyle = "#f5f8ff";
      context.fillText(person.city, labelX + 9, labelY);
    });

    if (!reducedMotion) frame = requestAnimationFrame(draw);
  };

  const onPointerDown = (event) => {
    dragging = true;
    moved = false;
    pointerX = event.clientX;
    pointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragging) return;
    const deltaX = event.clientX - pointerX;
    const deltaY = event.clientY - pointerY;
    moved ||= Math.abs(deltaX) + Math.abs(deltaY) > 2;
    centerLon -= deltaX * 0.008;
    centerLat = Math.max(-1.15, Math.min(1.15, centerLat + deltaY * 0.006));
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (reducedMotion) draw(performance.now());
  };

  const onPointerUp = (event) => {
    dragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };

  const onDoubleClick = () => {
    centerLon = toRadians(midpointLon);
    centerLat = toRadians(midpointLat);
    if (reducedMotion) draw(performance.now());
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("dblclick", onDoubleClick);
  resize();
  frame = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("dblclick", onDoubleClick);
  };
}

function roundedRectangle(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}
