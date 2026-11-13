"use strict";

const planFormats = [
  {
    match: /声音地图|声景地图|街区录音|声音路线|sound\s*map/i,
    name: "街区声音地图",
    concept: "选一条可以走完的路线，把每个停留点的录音、地点和观察放在同一个地图标记里，让人可以边走边听。",
    setup: "先画出起点、三个停留点和终点。给每站编号，用同一编号标记录音、照片和地点说明。",
    output: "一张三站地图，每站带可试听的录音和一句地点说明。",
    check: "请一个没走过的人照图找到第一站，并试听对应的录音。",
  },
  {
    match: /老照片|旧照片|照片修复|修复照片|photo restoration/i,
    name: "照片故事页",
    concept: "围绕同一张照片，把修复前后的变化与家人的回忆放在一起，让画面细节有出处。",
    setup: "选一张照片，保留原图，另建副本。给原图、副本和人物地点说明使用同一组编号。",
    output: "一页可打印的照片故事，包含原图、修复对照和经过确认的说明。",
    check: "请熟悉照片的人核对人物、地点和修复后仍需保留的细节。",
  },
  {
    match: /生日|寿宴|birthday/i,
    name: "生日惊喜小样",
    concept: "用一段共同回忆串起祝福、照片和揭晓动作，让收到惊喜的人知道每份素材和自己有什么关系。",
    setup: "确定当天交付的时间和地点。选一张合照作开场，把祝福、照片和播放顺序放进同一个备忘录。",
    output: "一份能按顺序执行的惊喜流程，附上要用的祝福和照片。",
    check: "请一位家人照流程试走一遍，确认下一步清楚，音量和文字也合适。",
  },
  {
    match: /短片|短视频|分镜|试片|剪辑|short film/i,
    name: "短片样片",
    concept: "让所选灵感各贡献一个镜头、一个声音或一个叙事动作，再剪成一段能看懂的样片。",
    setup: "写下一句话讲清主角做了什么。画出开场、关键动作和结果三格，用同一份素材清单标出缺少的镜头或声音。",
    output: "一条可播放的短片样片，附三格分镜和素材清单。",
    check: "请一个第一次看的人复述开场、动作和结果，把说不清的一处补进分镜。",
  },
  {
    match: /奶茶|试喝|试饮|咖啡|配方|珍珠|拿铁|coffee|boba/i,
    name: "风味试饮方案",
    concept: "把所选灵感转成同一场试饮里的风味、呈现和反馈，看看哪种组合最值得复做。",
    setup: "选一份底料，准备编号小杯和记录表。每杯只改一个条件，提前写下配比或呈现方式。",
    output: "一组试饮小样、一张配方卡，以及一份口感和选择记录。",
    check: "请一位试喝者先选出最想再喝的一杯，再核对配方记录能否复做。",
  },
  {
    match: /城市漫游|散步|街区|步行|路口|徒步|walk|trail/i,
    name: "可试走的路线卡",
    concept: "选一条共同路线，把各个灵感变成沿途能体验的停留点、观察任务或辨认提示。",
    setup: "在纸上画起点、三个停留点和终点。每个点留出写地标、用时和体验动作的位置。",
    output: "一张能转发的路线卡，包含起点、停留点、体验任务和总用时。",
    check: "请一位没走过的人凭路线卡试走第一段，在停下来确认方向的地方加一张辨认照。",
  },
];

const defaultPlanFormat = {
  name: "创意原型",
  concept: "围绕一个共同主题做一份小样。把选中的点子落到同一份成果上，每条负责一个可以看见或试用的部分。",
  setup: "用一张纸写下目标、现有材料和预计用时。为每条灵感留一格，先在格里写下它要贡献的具体内容。",
  output: "一份可以展示或试用的小样，附执行清单、所用材料和一次试做记录。",
  check: "请一个第一次看到的人试用或复述做法。记下第一处卡点，改完再试一次。",
};

function makeCreativePlan(entries) {
  const roots = [...new Set(entries.map(({ route }) => route[0].label))];
  const theme = roots.map(root => titleText(root, 24)).join(" × ");
  const selectedTitles = entries.map(({ idea }) => idea.title).join(" ");
  const pathTitles = entries.flatMap(({ route }) => route.map(({ label }) => label)).join(" ");
  const format = roots.length === 1
    ? planFormats.find(({ match }) => match.test(selectedTitles))
      ?? planFormats.find(({ match }) => match.test(pathTitles))
      ?? defaultPlanFormat
    : defaultPlanFormat;
  const name = `${theme} · ${format.name}`;
  const order = [...entries].sort((a, b) => a.route.length - b.route.length);
  const [lead, ...supporting] = order.map(({ idea }) => `「${titleText(idea.title, 32)}」`);
  const concept = `以${lead}为起点，把${supporting.join("、")}接入同一个成品。${format.concept}`;

  const steps = [
    { title: "准备共同素材", detail: format.setup },
    ...order.map(({ idea, route }) => {
      const parent = route.length > 1 ? route.at(-1).label : "";
      const connection = parent ? `沿用「${parent}」的素材或结果。` : "";
      return { title: idea.title, detail: connection + idea.detail };
    }),
    { title: "合并成品并试一次", detail: `把每一步的结果按使用顺序放在同一份成品里。${format.check}` },
  ];
  return { name, concept, steps, deliverable: format.output };
}

function setupIdeaPlanner({ getCandidates, beforeOpen, copy }) {
  const planner = document.getElementById("plan-dialog");
  const opener = document.getElementById("open-plan");
  const badge = document.getElementById("plan-badge");
  const picker = document.getElementById("plan-picker");
  const options = document.getElementById("plan-options");
  const count = document.getElementById("plan-count");
  const generate = document.getElementById("generate-plan");
  const result = document.getElementById("plan-result");
  const content = document.getElementById("plan-content");
  const copyPlan = document.getElementById("copy-plan");
  const status = document.getElementById("plan-status");

  const chosen = new Map();
  let currentPlan;

  function updateCount() {
    badge.hidden = chosen.size === 0;
    badge.textContent = chosen.size;
    count.textContent = `已选 ${chosen.size} 条`;
    generate.disabled = chosen.size < 2;
  }

  function showPicker() {
    const candidates = new Map(chosen);
    for (const entry of getCandidates()) {
      candidates.set(mapKey([...entry.route, { label: entry.idea.title, idea: entry.idea }]), entry);
    }

    const rows = Array.from(candidates, ([key, entry]) => {
      const label = document.createElement("label");
      label.className = "plan-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = chosen.has(key);
      const name = document.createElement("strong");
      name.textContent = entry.idea.title;
      const trail = document.createElement("small");
      trail.textContent = entry.route.map(({ label }) => label).join(" › ");
      const description = document.createElement("span");
      description.append(name, trail);
      label.append(checkbox, description);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) chosen.set(key, entry);
        else chosen.delete(key);
        updateCount();
      });
      return label;
    });

    options.replaceChildren(...rows);
    updateCount();
    picker.hidden = false;
    result.hidden = true;
    currentPlan = undefined;
  }

  opener.addEventListener("click", () => {
    beforeOpen();
    showPicker();
    planner.showModal();
    options.querySelector("input")?.focus();
  });

  generate.addEventListener("click", () => {
    if (chosen.size < 2) return;
    const plan = makeCreativePlan([...chosen.values()]);
    currentPlan = plan;
    document.getElementById("plan-name").textContent = plan.name;
    document.getElementById("plan-concept").textContent = plan.concept;
    document.getElementById("plan-deliverable").textContent = plan.deliverable;
    document.getElementById("plan-steps").replaceChildren(...plan.steps.map(step => {
      const row = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = step.title;
      const detail = document.createElement("p");
      detail.textContent = step.detail;
      row.append(title, detail);
      return row;
    }));
    copyPlan.textContent = "复制方案";
    status.textContent = "";
    picker.hidden = true;
    result.hidden = false;
    content.focus();
  });

  document.getElementById("edit-plan").addEventListener("click", () => {
    showPicker();
    options.querySelector("input:checked, input")?.focus();
  });

  copyPlan.addEventListener("click", async () => {
    const plan = currentPlan;
    if (!plan) return;
    const steps = plan.steps.map(({ title, detail }, index) =>
      `${index + 1}. ${title}\n${detail}`
    ).join("\n\n");
    const text = [plan.name, `核心想法\n${plan.concept}`, `具体执行步骤\n${steps}`, `最终成果\n${plan.deliverable}`].join("\n\n");
    const isCurrent = () => planner.open && currentPlan === plan;
    if (await copy(text, "复制方案", isCurrent) && isCurrent()) {
      copyPlan.textContent = "已复制";
      status.textContent = "已复制完整创意方案";
    }
  });
}
