/* global navigator, location, history */

const QUESTIONS = [
  {
    id: "food",
    text: "聚餐时，你更想吃什么？",
    choices: ["火锅", "烧烤", "日料", "粤菜"],
  },
  {
    id: "pet",
    text: "如果养一只宠物，你更倾向？",
    choices: ["猫", "狗", "仓鼠/兔子", "我更喜欢植物"],
  },
  {
    id: "travel",
    text: "旅行你更喜欢哪种节奏？",
    choices: ["特种兵打卡", "躺平慢游", "边走边看随缘", "宅酒店也算旅行"],
  },
  {
    id: "music",
    text: "通勤时你更可能在听？",
    choices: ["流行", "摇滚/金属", "电子/嘻哈", "播客/有声书"],
  },
  {
    id: "night",
    text: "晚上 11 点你通常在？",
    choices: ["准备睡觉", "刷手机", "学习/工作", "打游戏/追剧"],
  },
  {
    id: "superpower",
    text: "如果只能选一个超能力？",
    choices: ["时间暂停", "瞬移", "读心术", "无限精力"],
  },
];

const ROLE = {
  CREATE: "create",
  JOIN: "join",
};

function qs(sel) {
  return document.querySelector(sel);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function toBase64Url(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const str = decodeURIComponent(escape(atob(b64)));
  return str;
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function buildInviteHash(payload) {
  const json = JSON.stringify(payload);
  return `#mq=${toBase64Url(json)}`;
}

function readInviteFromHash() {
  const m = location.hash.match(/(?:^|[#&])mq=([^&]+)/);
  if (!m) return null;
  const raw = fromBase64Url(m[1]);
  const data = safeJsonParse(raw);
  if (!data || data.v !== 1) return null;
  if (!Array.isArray(data.a) || data.a.length !== QUESTIONS.length) return null;
  return data;
}

function setHash(hash) {
  const base = location.href.split("#")[0];
  history.replaceState(null, "", `${base}${hash}`);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const els = {
  panelIntro: qs("#panelIntro"),
  panelQuiz: qs("#panelQuiz"),
  panelLink: qs("#panelLink"),
  panelResult: qs("#panelResult"),

  btnCreate: qs("#btnCreate"),
  btnJoin: qs("#btnJoin"),
  btnReset: qs("#btnReset"),

  roleBadge: qs("#roleBadge"),
  progressBar: qs("#progressBar"),
  stepText: qs("#stepText"),
  qText: qs("#qText"),
  choices: qs("#choices"),
  btnBack: qs("#btnBack"),
  btnSkip: qs("#btnSkip"),

  inviteLink: qs("#inviteLink"),
  btnCopy: qs("#btnCopy"),
  btnShare: qs("#btnShare"),
  btnNew: qs("#btnNew"),

  scoreNum: qs("#scoreNum"),
  scoreText: qs("#scoreText"),
  resultList: qs("#resultList"),
  btnRematch: qs("#btnRematch"),
  btnReplay: qs("#btnReplay"),
};

const state = {
  role: null,
  idx: 0,
  answers: Array(QUESTIONS.length).fill(null),
  creator: null, // {name?, a: [...]}
  order: QUESTIONS.map((q) => q.id),
};

function showOnly(panel) {
  els.panelIntro.classList.add("hidden");
  els.panelQuiz.classList.add("hidden");
  els.panelLink.classList.add("hidden");
  els.panelResult.classList.add("hidden");
  panel.classList.remove("hidden");
}

function renderQuiz() {
  const total = QUESTIONS.length;
  const idx = clamp(state.idx, 0, total - 1);
  state.idx = idx;

  const q = QUESTIONS[idx];
  els.qText.textContent = q.text;
  els.stepText.textContent = `${idx + 1} / ${total}`;
  els.progressBar.style.width = `${Math.round(((idx + 1) / total) * 100)}%`;
  els.roleBadge.textContent = state.role === ROLE.CREATE ? "创建者：先答题生成邀请" : "加入者：答同样的问题";

  const choices = shuffle(q.choices).map((label) => ({ label }));
  els.choices.innerHTML = "";
  for (const c of choices) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.textContent = c.label;
    btn.addEventListener("click", () => onPick(c.label));
    els.choices.appendChild(btn);
  }

  els.btnBack.disabled = idx === 0;
}

function onPick(label) {
  state.answers[state.idx] = label;
  if (state.idx < QUESTIONS.length - 1) {
    state.idx += 1;
    renderQuiz();
    return;
  }
  onFinish();
}

function onSkip() {
  const q = QUESTIONS[state.idx];
  const random = q.choices[Math.floor(Math.random() * q.choices.length)];
  onPick(random);
}

function onFinish() {
  if (state.role === ROLE.CREATE) {
    const payload = { v: 1, t: Date.now(), a: state.answers };
    const hash = buildInviteHash(payload);
    setHash(hash);
    const link = `${location.href.split("#")[0]}${hash}`;
    els.inviteLink.value = link;
    showOnly(els.panelLink);
    return;
  }

  const creatorAnswers = state.creator?.a ?? [];
  const joinAnswers = state.answers;
  const total = QUESTIONS.length;
  let score = 0;
  const items = [];

  for (let i = 0; i < total; i++) {
    const ok = creatorAnswers[i] === joinAnswers[i];
    if (ok) score += 1;
    items.push({
      idx: i,
      ok,
      q: QUESTIONS[i].text,
      a1: creatorAnswers[i],
      a2: joinAnswers[i],
    });
  }

  els.scoreNum.textContent = String(score);
  els.scoreText.textContent = `/ ${total}`;
  els.resultList.innerHTML = "";

  for (const it of items) {
    const div = document.createElement("div");
    div.className = "resultItem";
    const tag = it.ok ? `<span class="tag ok">一致</span>` : `<span class="tag bad">不一致</span>`;
    div.innerHTML = `
      <div class="resultItemTop">
        <div style="font-weight:900">${it.idx + 1}. ${escapeHtml(it.q)}</div>
        ${tag}
      </div>
      <div class="qa">
        <div><b>TA 选</b>：${escapeHtml(String(it.a1 ?? ""))}</div>
        <div><b>你选</b>：${escapeHtml(String(it.a2 ?? ""))}</div>
      </div>
    `;
    els.resultList.appendChild(div);
  }

  showOnly(els.panelResult);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

async function shareLink(url) {
  if (navigator.share) {
    try {
      await navigator.share({ title: "默契问答小游戏", text: "来测测我们有多默契", url });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function startCreate() {
  state.role = ROLE.CREATE;
  state.idx = 0;
  state.answers = Array(QUESTIONS.length).fill(null);
  state.creator = null;
  showOnly(els.panelQuiz);
  renderQuiz();
}

function startJoin(invite) {
  state.role = ROLE.JOIN;
  state.idx = 0;
  state.answers = Array(QUESTIONS.length).fill(null);
  state.creator = invite;
  showOnly(els.panelQuiz);
  renderQuiz();
}

function resetAll() {
  state.role = null;
  state.idx = 0;
  state.answers = Array(QUESTIONS.length).fill(null);
  state.creator = null;
  setHash("");
  showOnly(els.panelIntro);
}

function init() {
  els.btnCreate.addEventListener("click", startCreate);
  els.btnJoin.addEventListener("click", () => {
    const invite = readInviteFromHash();
    if (invite) startJoin(invite);
    else alert("没有检测到邀请信息。请从朋友发来的链接进入，或确保地址栏包含 #mq=...");
  });
  els.btnReset.addEventListener("click", resetAll);

  els.btnBack.addEventListener("click", () => {
    state.idx = clamp(state.idx - 1, 0, QUESTIONS.length - 1);
    renderQuiz();
  });
  els.btnSkip.addEventListener("click", onSkip);

  els.btnCopy.addEventListener("click", async () => {
    const ok = await copyText(els.inviteLink.value);
    els.btnCopy.textContent = ok ? "已复制" : "复制失败";
    setTimeout(() => (els.btnCopy.textContent = "复制"), 1200);
  });

  els.btnShare.addEventListener("click", async () => {
    const url = els.inviteLink.value;
    const ok = await shareLink(url);
    if (!ok) {
      const copied = await copyText(url);
      alert(copied ? "当前环境不支持系统分享，已帮你复制链接。" : "当前环境不支持系统分享，请手动复制链接。");
    }
  });

  els.btnNew.addEventListener("click", () => startCreate());

  els.btnRematch.addEventListener("click", startCreate);
  els.btnReplay.addEventListener("click", () => {
    const invite = readInviteFromHash();
    if (invite) startJoin(invite);
    else resetAll();
  });

  const invite = readInviteFromHash();
  if (invite) startJoin(invite);
  else showOnly(els.panelIntro);
}

init();

