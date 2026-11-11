"use strict";

const element = (id) => document.getElementById(id);
const branchTemplate = element("branch-template");
const savedTemplate = element("saved-template");
const form = element("idea-form");
const input = element("keyword");
const title = element("result-title");
const trail = element("trail");
const hint = element("graph-hint");
const plot = element("plot");
const connections = element("connections");
const branches = element("branches");
const detail = element("idea-detail");
const detailTitle = element("detail-title");
const detailCategory = element("detail-category");
const detailText = element("detail-text");
const detailSave = element("save-detail");
const notice = element("notice");
const dialog = element("saved-dialog");
const savedList = element("saved-list");
const savedEmpty = element("saved-empty");
const savedCount = element("saved-count");
const storageKey = "inspiration-studio-saved-v1";

let path = [{ topic: "咖啡", label: "咖啡", batch: 0 }];
let activeIdea;
let graph = [];
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

function explore(idea, route) {
  path = [...route, { topic: idea.title, label: idea.title, batch: 0 }];
  render(true);
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
  if (announce) notice.textContent = `已选中「${idea.title}」。${idea.detail}`;
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
  hint.hidden = !trail.hidden;
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
}

function render(focusTitle = false) {
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
      item.style.setProperty("--delay", `${index * 46}ms`);
    }
    node.querySelector(".branch-marker").textContent = idea.icon;
    node.querySelector(".branch-category").textContent = idea.label;
    node.querySelector(".branch-title").textContent = idea.title;
    node.title = idea.title;
    node.addEventListener("click", () => selectIdea(idea));
    return { node, connection, idea };
  });
  branches.replaceChildren(...graph.map(({ node }) => node));
  connections.replaceChildren(...graph.map(({ connection }) => connection));
  positionConnections();
  selectIdea(ideas.find((idea) => idea.id === current.selected) ?? ideas[0], false);
  notice.textContent = `「${current.label}」的第 ${current.batch + 1} 批，已生成 ${ideas.length} 条分支。`;
  if (focusTitle) {
    title.focus({ preventScroll: true });
    element("results").scrollIntoView({ block: "nearest" });
  }
}

function start(topic) {
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
element("examples").addEventListener("click", (event) => {
  const example = event.target.closest("button[data-keyword]");
  if (!example) return;
  input.value = example.dataset.keyword;
  input.setCustomValidity("");
  start(input.value);
});
element("more").addEventListener("click", () => {
  path.at(-1).batch += 1;
  render();
});
detailSave.addEventListener("click", () => toggleSaved(ideaKey(activeIdea, path), activeIdea, path));
element("explore-detail").addEventListener("click", () => explore(activeIdea, path));
element("open-saved").addEventListener("click", () => {
  renderSaved();
  dialog.showModal();
});

new ResizeObserver(positionConnections).observe(plot);
updateCount();
render();
