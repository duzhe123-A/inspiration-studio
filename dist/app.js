"use strict";

const element = id => document.getElementById(id);
const plot = element("plot");
const world = element("world");
const branches = element("branches");
const connections = element("connections");
const input = element("keyword");
const attach = element("attach");
const detail = element("idea-detail");
const savedDialog = element("saved-dialog");
const copyDialog = element("copy-dialog");
const copyText = element("copy-text");
const notice = element("notice");
const tray = element("tray-picks");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const storageKey = "inspiration-studio-saved-v1";
const saved = readSaved();
const nodes = new Map();
const pointers = new Map();
const camera = { x: 0, y: 0, scale: 1 };
let active, root, cameraFrame, gesture, draggedUntil = 0;
let autoFit = true;
let picked = new Map();
let toastTimer, detailCopyTimer;

function mapKey(route) {
  return JSON.stringify(route.map(({ label, idea }) => [label, idea?.id, idea?.detail]));
}

const ideaKey = (idea, route) => JSON.stringify([route.map(step => step.topic), idea.id, idea.title, idea.detail]);
const asEntry = node => ({ idea: node.idea, route: node.route.slice(0, -1) });
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function announce(message, visible = false) {
  notice.textContent = message;
  if (!visible) return;
  notice.classList.remove("sr-only");
  notice.classList.add("toast");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    notice.classList.remove("toast");
    notice.classList.add("sr-only");
  }, 2400);
}

function drawCamera() {
  world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
  element("zoom-level").textContent = Math.round(camera.scale * 100) + "%";
}

function stopCamera() {
  cancelAnimationFrame(cameraFrame);
}

function moveCamera(next, animate = true) {
  stopCamera();
  if (!animate || motion.matches) {
    Object.assign(camera, next);
    drawCamera();
    return;
  }
  const from = { ...camera };
  const start = performance.now();
  const frame = now => {
    const t = clamp((now - start) / 400, 0, 1);
    const ease = 1 - (1 - t) ** 3;
    for (const key of ["x", "y", "scale"]) camera[key] = from[key] + (next[key] - from[key]) * ease;
    drawCamera();
    if (t < 1) cameraFrame = requestAnimationFrame(frame);
  };
  cameraFrame = requestAnimationFrame(frame);
}

function viewArea() {
  const width = plot.clientWidth;
  const height = plot.clientHeight;
  const mobile = width <= 690;
  const top = mobile ? Math.min(140, height * .27) : 78;
  const bottom = mobile ? Math.min(112, height * .25) : 90;
  return { width: width - 24, height: Math.max(1, height - top - bottom), x: width / 2, y: (height + top - bottom) / 2 };
}

function fit(nodesToFit = [...nodes.values()], animate = true) {
  if (!nodesToFit.length) return;
  autoFit = nodesToFit.length === nodes.size;
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const node of nodesToFit) {
    const radius = node.expanded ? 81 : 60;
    left = Math.min(left, node.x - radius);
    right = Math.max(right, node.x + radius);
    top = Math.min(top, node.y - radius);
    bottom = Math.max(bottom, node.y + radius);
  }
  const view = viewArea();
  const scale = Math.min(1, view.width / (right - left), view.height / (bottom - top));
  moveCamera({ scale, x: view.x - (left + right) / 2 * scale, y: view.y - (top + bottom) / 2 * scale }, animate);
}

function centerOn(node) {
  autoFit = false;
  const view = viewArea();
  const scale = clamp(Math.min(view.width / 510, view.height / 530), .46, 1.05);
  moveCamera({ scale, x: view.x - node.x * scale, y: view.y - node.y * scale });
}

function zoomAt(x, y, desired, min = Math.min(.20, camera.scale)) {
  const scale = clamp(desired, min, 2.5);
  const ratio = scale / camera.scale;
  camera.x = x - (x - camera.x) * ratio;
  camera.y = y - (y - camera.y) * ratio;
  camera.scale = scale;
  autoFit = false;
  drawCamera();
}

function nextPosition(parent, index, count, batch) {
  const direction = parent.parent ? Math.atan2(parent.y - parent.parent.y, parent.x - parent.parent.x) : -Math.PI / 2;
  const spread = Math.PI * 1.13;
  const angle = !parent.parent && batch === 0
    ? direction + (index / count) * Math.PI * 2
    : direction + (parent.parent ? ((index + .5) / count - .5) * spread : (index + .5) / count * Math.PI * 2);
  const base = parent.parent ? 225 : 228;
  for (let ring = 0; ; ring += 1) {
    const distance = base + ring * 120;
    for (const wiggle of [0, .18, -.18, .36, -.36, .56, -.56]) {
      const x = parent.x + distance * Math.cos(angle + wiggle);
      const y = parent.y + distance * Math.sin(angle + wiggle);
      if ([...nodes.values()].every(node => (node.x - x) ** 2 + (node.y - y) ** 2 >= 166 ** 2)) return { x, y };
    }
  }
}

function addNode(parent, step, position, delay = 0, animate = true) {
  const route = parent ? [...parent.route, step] : [step];
  const key = mapKey(route);
  const existing = nodes.get(key);
  if (existing) return existing;
  const { x, y } = position;
  const el = document.createElement("div");
  el.className = "node";
  el.style.left = x + "px";
  el.style.top = y + "px";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "node-button";
  button.title = step.label;
  const name = document.createElement("strong");
  name.textContent = step.label;
  const caption = document.createElement("small");
  caption.textContent = step.idea?.label ?? "起始关键词";
  button.append(name, caption);
  el.append(button);
  const node = { key, parent, route, idea: step.idea, label: step.label, el, button, x, y, batch: 0, expanded: false, children: [] };
  nodes.set(key, node);
  branches.append(el);

  if (parent) {
    parent.children.push(node);
    const dx = x - parent.x, dy = y - parent.y;
    const link = document.createElement("div");
    link.className = "link";
    link.style.cssText = `left:${parent.x}px;top:${parent.y}px;width:${Math.hypot(dx, dy)}px;transform:rotate(${Math.atan2(dy, dx)}rad)`;
    connections.append(link);
    if (animate) {
      link.classList.add("new");
      link.style.setProperty("--delay", delay + "ms");
      el.classList.add("new");
      el.style.setProperty("--delay", delay + "ms");
      el.style.setProperty("--from-x", -dx + "px");
      el.style.setProperty("--from-y", -dy + "px");
    }
  }

  button.addEventListener("click", event => {
    if (event.detail && performance.now() < draggedUntil) return;
    focusNode(node);
  });
  if (node.idea) {
    button.addEventListener("contextmenu", event => {
      event.preventDefault();
      if (!gesture && performance.now() >= draggedUntil) planner.toggle(asEntry(node));
    });
  }
  button.addEventListener("focus", () => {
    if (!button.matches(":focus-visible")) return;
    const { top, bottom, left, right } = button.getBoundingClientRect();
    if (left < 0 || right > plot.clientWidth || top < 0 || bottom > plot.clientHeight) centerOn(node);
  });
  updateNode(node);
  return node;
}

function updateNode(node) {
  const isPicked = picked.has(node.key);
  node.el.classList.toggle("is-picked", isPicked);
  node.el.classList.toggle("is-active", active === node);
  node.el.classList.toggle("is-hub", node.expanded);
  node.button.setAttribute("aria-current", active === node ? "true" : "false");
  node.button.setAttribute("aria-label", node.label + (node.expanded ? "，已展开" : "，继续发散") + (isPicked ? "，已加入方案" : ""));
}

function addBatch(node, animate = true) {
  const used = new Set(node.children.map(child => child.label));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const batch = node.batch++;
    const ideas = makeIdeas(node.route, batch).filter(idea => !used.has(idea.title));
    if (!ideas.length) continue;
    return ideas.map((idea, index) => addNode(node, { topic: idea.title, label: idea.title, idea }, nextPosition(node, index, ideas.length, batch), index * 14, animate));
  }
  return [];
}

function markExpanded(node, animate = true) {
  if (node.expanded) return;
  node.expanded = true;
  addBatch(node, animate);
  updateNode(node);
}

function showActive(node) {
  const previous = active;
  active = node;
  if (previous) updateNode(previous);
  if (node) updateNode(node);
  element("empty-graph").hidden = Boolean(node);
  element("more").hidden = !node;
  element("canvas-tip").hidden = !node;
  element("zoom-controls").hidden = !node;
  element("open-plan").disabled = !node;
  attach.disabled = !node;
  const pick = element("pick-active");
  pick.hidden = !node?.idea;
  element("open-detail").hidden = !node?.idea;
  const isPicked = node ? picked.has(node.key) : false;
  pick.setAttribute("aria-pressed", String(isPicked));
  element("pick-label").textContent = isPicked ? "✓ 已加入方案" : "＋ 加入方案";
  updateComposer();
}

function focusNode(node) {
  markExpanded(node);
  showActive(node);
  centerOn(node);
  announce(`「${node.label}」有 ${node.children.length} 条分支`);
}

function clearGraph() {
  stopCamera();
  nodes.clear();
  branches.replaceChildren();
  connections.replaceChildren();
  active = undefined;
  root = undefined;
}

function start(topic, animate = true) {
  clearGraph();
  root = addNode(null, { topic, label: topic }, { x: 0, y: 0 });
  markExpanded(root, animate);
  showActive(root);
  fit(undefined, false);
  announce(`从「${topic}」开始发散`);
}

function updateComposer() {
  const linked = active && attach.getAttribute("aria-pressed") === "true";
  if (linked) {
    input.placeholder = `连接到「${titleText(active.label, 16)}」…`;
  } else {
    input.placeholder = active ? "输入任意关键词，开始发散…" : "例如：城市漫游";
  }
  const submit = element("idea-form").querySelector('[type="submit"]');
  submit.setAttribute("aria-label", linked ? "添加并发散" : "开始发散");
  submit.title = submit.getAttribute("aria-label");
}

attach.addEventListener("click", () => {
  attach.setAttribute("aria-pressed", String(attach.getAttribute("aria-pressed") !== "true"));
  updateComposer();
  input.focus();
});

element("idea-form").addEventListener("submit", event => {
  event.preventDefault();
  const topic = input.value.trim();
  if (!topic) return;
  input.value = "";
  input.blur();
  if (attach.getAttribute("aria-pressed") !== "true") {
    start(topic);
    return;
  }
  const existing = active.children.find(child => child.label === topic);
  const idea = { id: "manual", label: "自定义", title: topic, detail: `沿着「${active.label}」探索「${topic}」。先找一个具体场景，做一个能试用的小样。` };
  const child = existing ?? addNode(active, { topic, label: topic, idea }, nextPosition(active, 0, 1, active.batch));
  focusNode(child);
});

element("more").addEventListener("click", () => {
  const additions = addBatch(active);
  if (!additions.length) {
    announce("这个节点暂时没有新灵感。试试展开其中一条。", true);
    return;
  }
  fit([active, ...additions]);
  announce(`已追加 ${additions.length} 条分支`);
});

element("fit-view").addEventListener("click", () => fit());
for (const [id, ratio] of [["zoom-in", 1.25], ["zoom-out", .8]]) {
  element(id).addEventListener("click", () => {
    stopCamera();
    const view = viewArea();
    zoomAt(view.x, view.y, camera.scale * ratio);
  });
}
plot.addEventListener("wheel", event => {
  event.preventDefault();
  if (!root) return;
  stopCamera();
  const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? plot.clientHeight : 1;
  zoomAt(event.clientX, event.clientY, camera.scale * Math.exp(clamp(-event.deltaY * factor * .002, -.55, .55)));
}, { passive: false });

function pointerMetrics() {
  const [a, b] = pointers.values();
  if (!b) return { x: a.x, y: a.y, distance: 1 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
}

plot.addEventListener("pointerdown", event => {
  if (!root || event.button !== 0 || pointers.size >= 2) return;
  stopCamera();
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  gesture = { ...pointerMetrics(), moving: pointers.size === 2 || Boolean(gesture?.moving) };
  if (gesture.moving) plot.classList.add("dragging");
  if (!event.target.closest("button")) plot.setPointerCapture(event.pointerId);
});

plot.addEventListener("pointermove", event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const next = pointerMetrics();
  const dx = next.x - gesture.x, dy = next.y - gesture.y;
  if (!gesture.moving && Math.hypot(dx, dy) < 6) return;
  if (!plot.hasPointerCapture(event.pointerId)) plot.setPointerCapture(event.pointerId);
  if (pointers.size === 2) zoomAt(gesture.x, gesture.y, camera.scale * next.distance / gesture.distance);
  autoFit = false;
  camera.x += dx;
  camera.y += dy;
  drawCamera();
  gesture = { ...next, moving: true };
  plot.classList.add("dragging");
});

function endPointer(event) {
  if (!pointers.delete(event.pointerId)) return;
  if (gesture.moving) draggedUntil = performance.now() + 250;
  if (pointers.size) {
    gesture = { ...pointerMetrics(), moving: gesture.moving };
  } else {
    gesture = undefined;
    plot.classList.remove("dragging");
  }
}

window.addEventListener("pointerup", endPointer);
window.addEventListener("pointercancel", endPointer);
let oldSize = { width: plot.clientWidth, height: plot.clientHeight };
new ResizeObserver(() => {
  const newSize = { width: plot.clientWidth, height: plot.clientHeight };
  if (newSize.width === oldSize.width && newSize.height === oldSize.height) return;
  if (autoFit) {
    fit(undefined, false);
  } else {
    moveCamera({ x: camera.x + (newSize.width - oldSize.width) / 2, y: camera.y + (newSize.height - oldSize.height) / 2, scale: camera.scale }, false);
  }
  oldSize = newSize;
}).observe(plot);

function readSaved() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return new Map(Array.isArray(stored) ? stored : []);
  } catch {
    return new Map();
  }
}

function updateSavedCount() {
  element("saved-count").hidden = saved.size === 0;
  element("saved-count").textContent = saved.size;
}

function toggleSaved(entry) {
  const { idea, route } = entry;
  const key = ideaKey(idea, route);
  if (saved.has(key)) saved.delete(key);
  else saved.set(key, entry);
  try {
    localStorage.setItem(storageKey, JSON.stringify([...saved]));
  } catch {
    announce("收藏暂存在当前页面", true);
  }
  updateSavedCount();
}

function updateDetailSave() {
  const { idea, route } = asEntry(active);
  const isSaved = saved.has(ideaKey(idea, route));
  const button = element("save-detail");
  button.setAttribute("aria-pressed", String(isSaved));
  button.textContent = isSaved ? "★ 已收藏" : "☆ 收藏";
}

element("open-detail").addEventListener("click", () => {
  if (!active.idea) return;
  element("detail-title").textContent = active.label;
  element("detail-text").textContent = active.idea.detail;
  element("detail-path").textContent = active.route.map(step => step.label).join(" › ");
  clearTimeout(detailCopyTimer);
  element("copy-idea").textContent = "复制灵感";
  updateDetailSave();
  detail.showModal();
});

element("save-detail").addEventListener("click", () => {
  toggleSaved(asEntry(active));
  updateDetailSave();
});

async function copyToClipboard(text, heading, isCurrent) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!isCurrent()) return false;
    element("copy-title").textContent = heading;
    copyText.value = text;
    if (!copyDialog.open) copyDialog.showModal();
    copyText.focus();
    copyText.select();
    return false;
  }
}

element("copy-idea").addEventListener("click", async () => {
  const node = active;
  const isCurrent = () => detail.open && node === active;
  const text = [node.label, node.idea.detail, `发散路径：${node.route.map(step => step.label).join(" → ")}`].join("\n\n");
  if (await copyToClipboard(text, "复制灵感", isCurrent) && isCurrent()) {
    const button = element("copy-idea");
    button.textContent = "已复制";
    clearTimeout(detailCopyTimer);
    detailCopyTimer = setTimeout(() => { button.textContent = "复制灵感"; }, 1600);
  }
});

function restoreRoute({ idea, route }) {
  if (root?.label !== route[0].label) start(route[0].topic, false);
  let node = root;
  for (const step of [...route.slice(1), { topic: idea.title, label: idea.title, idea }]) {
    markExpanded(node, false);
    node = node.children.find(child => step.idea
      ? child.key === mapKey([...node.route, step])
      : child.label === step.label)
      ?? addNode(node, step, nextPosition(node, 0, 1, node.batch), 0, false);
  }
  focusNode(node);
  node.button.focus({ preventScroll: true });
}

function renderSaved() {
  const list = element("saved-list");
  element("saved-empty").hidden = saved.size > 0;
  list.replaceChildren(...[...saved].reverse().map(([key, entry], index) => {
    const { idea, route } = entry;
    const row = element("saved-template").content.firstElementChild.cloneNode(true);
    row.querySelector(".saved-name").textContent = idea.title;
    row.querySelector(".saved-topic").textContent = route.map(step => step.label).join(" › ");
    row.querySelector(".saved-description").textContent = idea.detail;
    const remove = row.querySelector(".save");
    remove.textContent = "★";
    remove.setAttribute("aria-label", `取消收藏：${idea.title}`);
    remove.addEventListener("click", () => {
      if (!saved.has(key)) return;
      toggleSaved(entry);
      renderSaved();
      (list.querySelectorAll(".save")[Math.min(index, saved.size - 1)] ?? savedDialog.querySelector(".close")).focus();
    });
    row.querySelector(".saved-explore").addEventListener("click", () => {
      savedDialog.close();
      restoreRoute(entry);
    });
    return row;
  }));
}

element("open-saved").addEventListener("click", () => {
  renderSaved();
  savedDialog.showModal();
});

const planner = setupIdeaPlanner({
  getCandidates: () => [...nodes.values()].filter(node => node.idea).map(asEntry),
  copy: copyToClipboard,
  onLimit: () => announce("每份方案最多选择 8 条灵感", true),
  onSelectionChange(entries) {
    if (picked.size === entries.size && [...entries.keys()].every(key => picked.has(key))) return;
    picked = new Map(entries);
    const focusedChip = document.activeElement?.closest(".pick-chip");
    tray.replaceChildren(...[...picked.values()].map(entry => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "pick-chip";
      chip.textContent = titleText(entry.idea.title, 20) + " ×";
      chip.setAttribute("aria-label", `从方案移除「${entry.idea.title}」`);
      chip.addEventListener("click", () => planner.toggle(entry));
      return chip;
    }));
    tray.hidden = !picked.size;
    element("tray-empty").hidden = picked.size > 0;
    tray.closest(".tray").classList.toggle("has-picks", picked.size >= 2);
    for (const node of nodes.values()) updateNode(node);
    if (active) showActive(active);
    if (focusedChip) (tray.firstElementChild ?? element("open-plan")).focus();
    announce(`已收集 ${picked.size} 条灵感`);
  },
});

element("pick-active").addEventListener("click", () => {
  if (active.idea) planner.toggle(asEntry(active));
});

element("restart").addEventListener("click", () => {
  clearGraph();
  planner.clearSelection();
  attach.setAttribute("aria-pressed", "false");
  input.value = "";
  const { x, y } = viewArea();
  autoFit = true;
  moveCamera({ x, y, scale: 1 }, false);
  showActive(undefined);
  input.focus({ preventScroll: true });
  announce("画布已清空，可以输入新关键词");
});

updateSavedCount();
start("超级个体", false);
