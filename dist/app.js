"use strict";

const element = (id) => document.getElementById(id);
const cardTemplate = element("card-template");
const form = element("idea-form");
const input = element("keyword");
const title = element("result-title");
const context = element("result-context");
const trail = element("trail");
const cards = element("cards");
const notice = element("notice");
const dialog = element("saved-dialog");
const savedList = element("saved-list");
const savedCount = element("saved-count");
const storageKey = "inspiration-studio-saved-v1";

let path = [{ topic: "咖啡", label: "咖啡", batch: 0 }];
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

function saveIdea(key, idea, route) {
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
}

function makeCard(idea, route, inDialog = false) {
  const fragment = cardTemplate.content.cloneNode(true);
  const card = fragment.firstElementChild;
  card.dataset.tone = idea.id;
  card.querySelector(".category-icon").textContent = idea.icon;
  card.querySelector(".category-name").textContent = idea.label;
  card.querySelector(".card-title").textContent = idea.title;
  card.querySelector(".card-detail").textContent = idea.detail;
  const key = ideaKey(idea, route);
  const saveButton = card.querySelector(".save");
  updateSaveButton(saveButton, key, idea.title);
  saveButton.addEventListener("click", () => {
    saveIdea(key, idea, route);
    updateSaveButton(saveButton, key, idea.title);
    if (inDialog) {
      const next = card.nextElementSibling?.querySelector(".save") ?? card.previousElementSibling?.querySelector(".save");
      renderSaved();
      const remaining = [...savedList.querySelectorAll(".save")].find((button) => button.getAttribute("aria-label") === next?.getAttribute("aria-label"));
      (remaining ?? dialog.querySelector(".close")).focus();
      render();
    }
  });
  if (inDialog) {
    const source = document.createElement("p");
    source.className = "saved-topic";
    source.textContent = route.map((step) => step.label).join(" › ");
    card.querySelector(".explore").before(source);
  }
  const explore = card.querySelector(".explore");
  explore.setAttribute("aria-label", `继续发散：${idea.title}`);
  explore.addEventListener("click", () => {
    if (inDialog) dialog.close();
    path = [...route, { topic: idea.title, label: idea.title, batch: 0 }];
    render(true);
  });
  return fragment;
}

function renderSaved() {
  if (saved.size === 0) {
    const empty = document.createElement("p");
    empty.textContent = "点击灵感卡片右上角的星星，即可在这里找回它。";
    savedList.replaceChildren(empty);
    return;
  }
  savedList.replaceChildren(...[...saved.values()].reverse().map(({ idea, route }) => makeCard(idea, route, true)));
}

function render(focusTitle = false) {
  const current = path.at(-1);
  title.textContent = current.label;
  context.textContent = path.length === 1 ? "当前关键词" : "正在继续发散";
  trail.hidden = path.length === 1;
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

  const ideas = makeIdeas(path, current.batch);
  cards.replaceChildren(...ideas.map((idea) => makeCard(idea, path)));
  notice.textContent = `「${current.label}」的第 ${current.batch + 1} 批，已生成 ${ideas.length} 条灵感。`;
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
element("open-saved").addEventListener("click", () => {
  renderSaved();
  dialog.showModal();
});

updateCount();
render();
