"use strict";

const element = (id) => document.getElementById(id);
const branchTemplate = element("branch-template");
const savedTemplate = element("saved-template");
const form = element("idea-form");
const input = element("keyword");
const keywordPanel = element("keyword-panel");
const exampleTopics = element("examples");
const more = element("more");
const workspace = element("results");
const workspaceToolbar = element("workspace-toolbar");
const title = element("result-title");
const center = title.closest(".center");
const trail = element("trail");
const hint = element("graph-hint");
const plot = element("plot");
const connections = element("connections");
const branches = element("branches");
const detail = element("idea-detail");
const detailTitle = element("detail-title");
const detailCategory = element("detail-category");
const detailText = element("detail-text");
const detailToggle = element("detail-toggle");
const detailToggleLabel = element("detail-toggle-label");
const detailSave = element("save-detail");
const copyButton = element("copy-idea");
const copyDialog = element("copy-dialog");
const copyText = element("copy-text");
const mapDialog = element("map-dialog");
const mapTree = element("map-tree");
const exploreButton = element("explore-detail");
const notice = element("notice");
const dialog = element("saved-dialog");
const savedList = element("saved-list");
const savedEmpty = element("saved-empty");
const savedCount = element("saved-count");
const storageKey = "inspiration-studio-saved-v1";

let path = [{ topic: "咖啡", label: "咖啡", batch: 0 }];
const explored = new Map();
let activeIdea;
let graph = [];
let cancelPromotion;
let copyFeedback;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const mobileLayout = matchMedia("(max-width: 600px)");
const saved = readSaved();

function readSaved() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return new Map(Array.isArray(stored) ? stored : []);
  } catch {
    return new Map();
  }
}

function ideaKey(idea, route) {
  return JSON.stringify([route.map((step) => step.topic), idea.id, idea.title, idea.detail]);
}

function updateSaveButton(button, key, ideaTitle) {
  const isSaved = saved.has(key);
  button.textContent = isSaved ? "★" : "☆";
  button.setAttribute("aria-pressed", String(isSaved));
  button.setAttribute("aria-label", `${isSaved ? "取消收藏" : "收藏"}：${ideaTitle}`);
}

function updateCount() {
  savedCount.hidden = saved.size === 0;
  savedCount.textContent = saved.size;
}

function toggleSaved(key, idea, route) {
  if (saved.has(key)) {
    saved.delete(key);
    notice.textContent = `已取消收藏「${idea.title}」`;
  } else {
    saved.set(key, { idea, route: route.map((step) => ({ ...step })) });
    notice.textContent = `已收藏「${idea.title}」`;
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify([...saved]));
  } catch {
    notice.textContent += "。收藏暂存在当前页面。";
  }
  updateCount();
  updateSaveButton(detailSave, ideaKey(activeIdea, path), activeIdea.title);
}

function enterExploration() {
  if (keywordPanel.classList.contains("is-compact")) return;
  keywordPanel.classList.add("is-compact");
  element("title").classList.add("sr-only");
  exampleTopics.hidden = true;
  element("search-controls").append(more);
}

function mapKey(route) {
  return JSON.stringify(route.map(({ label, idea }) => [label, idea?.id, idea?.detail]));
}

function rememberPath() {
  for (let length = 1; length <= path.length; length += 1) {
    const route = path.slice(0, length);
    explored.set(mapKey(route), route);
  }
}

function showMap() {
  cancelPromotion?.();
  rememberPath();

  const rows = new Map();
  const root = document.createDocumentFragment();
  const current = mapKey(path);
  for (const [key, route] of explored) {
    if (route[0].label !== path[0].label) continue;

    const row = document.createElement("li");
    const button = document.createElement("button");
    const name = route.at(-1).label;
    button.type = "button";
    button.className = "map-node";
    button.textContent = name;
    button.title = name;
    if (key === current) button.setAttribute("aria-current", "location");
    button.addEventListener("click", () => {
      mapDialog.close();
      path = route;
      render(true);
    });

    const children = document.createElement("ul");
    row.append(button, children);
    rows.set(key, children);
    const parent = rows.get(mapKey(route.slice(0, -1))) ?? root;
    parent.append(row);
  }

  mapTree.replaceChildren(root);
  mapDialog.showModal();
  const selected = mapTree.querySelector("[aria-current]");
  selected?.focus({ preventScroll: true });
  selected?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function setDetailExpanded(expanded) {
  detail.classList.toggle("is-expanded", expanded);
  detailToggle.setAttribute("aria-expanded", String(expanded));
  detailToggleLabel.textContent = expanded ? "收起详情" : "展开详情";
}

function keepGraphAboveDetail() {
  if (!mobileLayout.matches) return;
  const overlap = plot.getBoundingClientRect().bottom - detail.getBoundingClientRect().top;
  if (overlap > 0) window.scrollBy(0, Math.ceil(overlap + 8));
}

function explore(idea, route, source) {
  const nextPath = [...route, { topic: idea.title, label: idea.title, idea, batch: 0 }];
  const showNextLayer = () => {
    enterExploration();
    path = nextPath;
    render(true, true);
  };
  if (source && !reducedMotion.matches && typeof source.node.animate === "function") {
    promoteBranch(source, idea, showNextLayer);
  } else {
    showNextLayer();
  }
}

function promoteBranch({ node, connection }, idea, showNextLayer) {
  if (cancelPromotion) return;

  const marker = node.querySelector(".branch-marker");
  const from = marker.getBoundingClientRect();
  const to = center.getBoundingClientRect();
  const x = from.left + from.width / 2 - to.left - to.width / 2;
  const y = from.top + from.height / 2 - to.top - to.height / 2;
  const scale = from.width / to.width;
  const ghost = center.cloneNode(true);
  const ghostTitle = ghost.querySelector("h2");
  ghostTitle.removeAttribute("id");
  ghostTitle.removeAttribute("tabindex");
  ghostTitle.removeAttribute("title");
  ghostTitle.textContent = idea.title;
  ghost.setAttribute("aria-hidden", "true");
  ghost.classList.add("traveling-center");
  ghost.dataset.tone = idea.id;

  const travelingMarker = document.createElement("span");
  travelingMarker.className = "traveling-marker";
  travelingMarker.textContent = idea.icon;
  ghost.append(travelingMarker);
  plot.append(ghost);
  plot.classList.add("is-promoting");
  exploreButton.setAttribute("aria-disabled", "true");

  // The incoming branches take up the remaining 202 ms, including their stagger.
  const duration = 198;
  const movement = ghost.animate([
    { transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})` },
    { transform: "translate(-50%, -50%) scale(1)" },
  ], { duration, easing: "cubic-bezier(.3,.05,.2,1)", fill: "both" });
  const animations = [
    movement,
    travelingMarker.animate([
      { opacity: 1 }, { opacity: 1, offset: 0.18 }, { opacity: 0, offset: 0.78 }, { opacity: 0 },
    ], { duration, fill: "both" }),
    connection.animate([
      { opacity: 1 }, { opacity: 1, offset: 0.58 }, { opacity: 0 },
    ], { duration, fill: "both" }),
    ...[center, branches, ...graph.map((branch) => branch.connection).filter((line) => line !== connection)]
      .map((layer) => layer.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration, easing: "ease-out", fill: "both",
      })),
  ];
  cancelPromotion = () => {
    for (const animation of animations) animation.cancel();
    ghost.remove();
    plot.classList.remove("is-promoting");
    exploreButton.removeAttribute("aria-disabled");
    cancelPromotion = undefined;
  };
  movement.finished.then(showNextLayer, () => {});
}

function renderSaved() {
  savedEmpty.hidden = saved.size > 0;
  const entries = [...saved.entries()].reverse();
  const rows = entries.map(([key, { idea, route }], index) => {
    const row = savedTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector(".saved-name").textContent = idea.title;
    row.querySelector(".saved-topic").textContent = route.map((step) => step.label).join(" › ");
    row.querySelector(".saved-description").textContent = idea.detail;
    const saveButton = row.querySelector(".save");
    updateSaveButton(saveButton, key, idea.title);
    saveButton.addEventListener("click", () => {
      toggleSaved(key, idea, route);
      renderSaved();
      const remaining = savedList.querySelectorAll(".save");
      const next = remaining[Math.min(index, remaining.length - 1)];
      (next ?? dialog.querySelector(".close")).focus();
    });
    const exploreButton = row.querySelector(".saved-explore");
    exploreButton.setAttribute("aria-label", `继续发散：${idea.title}`);
    exploreButton.addEventListener("click", () => {
      dialog.close();
      explore(idea, route);
    });
    return row;
  });
  savedList.replaceChildren(...rows);
}

function selectIdea(idea, announce = true) {
  activeIdea = idea;
  clearTimeout(copyFeedback);
  copyButton.textContent = "复制灵感";
  path.at(-1).selected = idea.id;
  for (const { node, connection, idea: item } of graph) {
    const selected = item === idea;
    node.setAttribute("aria-pressed", String(selected));
    connection.classList.toggle("is-selected", selected);
  }
  detail.dataset.tone = idea.id;
  detailTitle.textContent = idea.title;
  detailCategory.textContent = idea.label;
  detailText.textContent = idea.detail;
  updateSaveButton(detailSave, ideaKey(idea, path), idea.title);
  if (announce) {
    workspace.classList.add("has-active-detail");
    setDetailExpanded(false);
    keepGraphAboveDetail();
    notice.textContent = `已选中「${idea.title}」。${idea.detail}`;
  }
}

async function copyIdea() {
  const idea = activeIdea;
  const route = path;
  const labels = [...route.map(({ label }) => label), idea.title];
  const text = [idea.title, idea.detail, `发散路径：${labels.join(" → ")}`].join("\n\n");

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    if (idea !== activeIdea || route !== path) return;
    copyText.value = text;
    if (!copyDialog.open) copyDialog.showModal();
    copyText.focus();
    copyText.select();
    return;
  }

  notice.textContent = `已复制「${idea.title}」`;
  if (idea !== activeIdea || route !== path) return;
  clearTimeout(copyFeedback);
  copyButton.textContent = "已复制";
  copyFeedback = setTimeout(() => {
    copyButton.textContent = "复制灵感";
  }, 1800);
}

function positionConnections() {
  const centerX = plot.clientWidth / 2;
  const centerY = plot.clientHeight / 2;
  for (const { node, connection } of graph) {
    const x = node.offsetLeft + node.offsetWidth / 2 - centerX;
    const y = node.offsetTop + node.offsetHeight / 2 - centerY;
    connection.style.width = `${Math.hypot(x, y)}px`;
    connection.style.transform = `translateY(-50%) rotate(${Math.atan2(y, x)}rad)`;
    node.style.setProperty("--enter-x", `${-x}px`);
    node.style.setProperty("--enter-y", `${-y}px`);
  }
}

function renderTrail() {
  trail.hidden = path.length === 1;
  hint.hidden = !trail.hidden || keywordPanel.classList.contains("is-compact");
  workspaceToolbar.classList.toggle("is-compact", hint.hidden && trail.hidden);
  trail.replaceChildren();
  for (const [index, step] of path.slice(0, -1).entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = step.label;
    button.title = step.label;
    button.addEventListener("click", () => {
      path = path.slice(0, index + 1);
      render(true);
    });
    const arrow = document.createElement("span");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "›";
    trail.append(button, arrow);
  }
  if (!trail.hidden) {
    const current = document.createElement("span");
    current.className = "trail-current";
    current.setAttribute("aria-current", "location");
    current.textContent = path.at(-1).label;
    trail.append(current);
    trail.scrollLeft = trail.scrollWidth;
  }
}

function render(focusTitle = false, enteringBranch = false) {
  cancelPromotion?.();
  plot.classList.toggle("is-expanding", enteringBranch);
  const current = path.at(-1);
  title.textContent = current.label;
  title.title = current.label;
  renderTrail();

  const ideas = makeIdeas(path, current.batch);
  graph = ideas.map((idea, index) => {
    const node = branchTemplate.content.firstElementChild.cloneNode(true);
    const connection = document.createElement("span");
    connection.className = "connection";
    for (const item of [node, connection]) {
      item.dataset.tone = idea.id;
      item.style.setProperty("--order", index);
    }
    node.querySelector(".branch-marker").textContent = idea.icon;
    node.querySelector(".branch-category").textContent = idea.label;
    node.querySelector(".branch-title").textContent = idea.title;
    node.title = idea.title;
    const branch = { node, connection, idea };
    node.addEventListener("click", () => {
      if (!cancelPromotion) selectIdea(idea);
    });
    node.addEventListener("dblclick", () => {
      if (!cancelPromotion) explore(idea, path, branch);
    });
    return branch;
  });
  branches.replaceChildren(...graph.map(({ node }) => node));
  connections.replaceChildren(...graph.map(({ connection }) => connection));
  positionConnections();
  selectIdea(ideas.find((idea) => idea.id === current.selected) ?? ideas[0], false);
  rememberPath();
  notice.textContent = `「${current.label}」的第 ${current.batch + 1} 批，已生成 ${ideas.length} 条分支。`;
  if (focusTitle) {
    workspace.classList.add("has-active-detail");
    setDetailExpanded(false);
    title.focus({ preventScroll: true });
    plot.scrollIntoView({ block: "nearest" });
    keepGraphAboveDetail();
  }
}

function start(topic) {
  enterExploration();
  path = [{ topic, label: topic, batch: 0 }];
  render(true);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const topic = input.value.trim();
  if (!topic) {
    input.setCustomValidity("请输入一个关键词或短语。");
    input.reportValidity();
    return;
  }
  start(topic);
});
input.addEventListener("input", () => input.setCustomValidity(""));
exampleTopics.addEventListener("click", (event) => {
  const example = event.target.closest("button[data-keyword]");
  if (!example) return;
  input.value = example.dataset.keyword;
  input.setCustomValidity("");
  start(input.value);
});
more.addEventListener("click", () => {
  path.at(-1).batch += 1;
  setDetailExpanded(false);
  render();
});
detailToggle.addEventListener("click", () => {
  setDetailExpanded(!detail.classList.contains("is-expanded"));
});
copyButton.addEventListener("click", copyIdea);
element("open-map").addEventListener("click", showMap);
detailSave.addEventListener("click", () => toggleSaved(ideaKey(activeIdea, path), activeIdea, path));
exploreButton.addEventListener("click", () => {
  if (cancelPromotion) return;
  const source = graph.find(({ idea }) => idea === activeIdea);
  explore(activeIdea, path, source);
});
element("open-saved").addEventListener("click", () => {
  cancelPromotion?.();
  renderSaved();
  dialog.showModal();
});

new ResizeObserver(positionConnections).observe(plot);
updateCount();
render();
