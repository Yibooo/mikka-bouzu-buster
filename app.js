// ============================================================
// 三日坊主バスター - app.js
// ============================================================

// --- Supabase ---
const SUPABASE_URL = "https://insrskeneuzkjfbbdikp.supabase.co";
const SUPABASE_KEY = "sb_publishable_9ZjRkan7xPELsoQ2VJcv3A_wg13DQjr";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let useCloud = false;

// --- X (Twitter) Integration ---
const X_CLIENT_ID = "WF9xaEpqRmRqWmxMZE1kNjNjbHg6MTpjaQ";
const SITE_URL = "https://mikka-bouzu-buster.com";
let xConnected = false;
let xUsername = "";

function getDeviceId() {
  let id = localStorage.getItem("hb_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("hb_device_id", id);
  }
  return id;
}

async function initAuth() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
    useCloud = true;
  } else {
    // Try anonymous sign-in
    const { data: anonData, error } = await sb.auth.signInAnonymously();
    if (!error && anonData.session) {
      currentUser = anonData.session.user;
      useCloud = true;
    }
  }
  sb.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    useCloud = !!currentUser;
  });
}

// --- i18n ---
const i18n = {
  ja: {
    appName: "三日坊主バスター",
    subtitle: "キャラを育てて、三日坊主を卒業しよう!",
    addHabit: "+ 習慣を追加",
    editHabit: "習慣を編集",
    habitName: "習慣名",
    challengePeriod: "チャレンジ期間",
    days: "日",
    save: "保存",
    cancel: "キャンセル",
    close: "閉じる",
    emptyMessage: "まだ習慣が登録されていません。",
    emptyHint: "下のボタンから追加しましょう!",
    checkIn: "達成!",
    done: "達成済み",
    missed: "未達成",
    edit: "編集",
    delete: "削除",
    deleteConfirm: "この習慣を削除しますか？",
    streak: "日連続",
    dayLeft: "日残り",
    rate: "達成率",
    resultSuccess: "チャレンジ成功!",
    resultFail: "チャレンジ失敗...",
    praise: [
      "すごい! 今日もやったね!",
      "がんばったね! 最高!",
      "継続は力なり!",
      "えらい! その調子!",
      "完璧! 明日も頑張ろう!",
      "素晴らしい! 自分を褒めよう!",
      "やるじゃん! カッコいい!",
    ],
    milestones: {
      3: "3日連続達成! 三日坊主を突破!",
      7: "1週間達成! すごい!",
      14: "2週間達成! 習慣になってきた!",
      30: "30日達成! マスターだ!",
    },
    xPost: "Xに投稿",
    xConnected: "X連携済み",
    xDisconnect: "X連携解除",
  },
  en: {
    appName: "Habit Buster",
    subtitle: "Grow your character by building habits!",
    addHabit: "+ Add Habit",
    editHabit: "Edit Habit",
    habitName: "Habit Name",
    challengePeriod: "Challenge Period",
    days: "d",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    emptyMessage: "No habits registered yet.",
    emptyHint: "Add one with the button below!",
    checkIn: "Done!",
    done: "Completed",
    missed: "Missed",
    edit: "Edit",
    delete: "Delete",
    deleteConfirm: "Delete this habit?",
    streak: " day streak",
    dayLeft: "d left",
    rate: "Rate",
    resultSuccess: "Challenge Complete!",
    resultFail: "Challenge Failed...",
    praise: [
      "Awesome! You did it!",
      "Great job! Keep it up!",
      "Consistency is key!",
      "Amazing! You're on fire!",
      "Perfect! See you tomorrow!",
      "Fantastic! Be proud!",
      "Nailed it! So cool!",
    ],
    milestones: {
      3: "3-day streak! No more quitting!",
      7: "1 week! Incredible!",
      14: "2 weeks! It's becoming a habit!",
      30: "30 days! You're a master!",
    },
    xPost: "Post to X",
    xConnected: "X Connected",
    xDisconnect: "Disconnect X",
  },
};

let lang = localStorage.getItem("hb_lang") || "ja";
const t = (key) => i18n[lang][key] || key;

// --- State ---
const STORAGE_KEY = "hb_habits";
let habits = [];
let editingId = null;

// --- Data Layer (Supabase + localStorage fallback) ---
async function loadHabits() {
  if (useCloud && currentUser) {
    const { data: hRows } = await sb
      .from("habits")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: true });

    if (hRows) {
      const { data: cRows } = await sb
        .from("checkins")
        .select("habit_id, date")
        .eq("user_id", currentUser.id);

      const checkinMap = {};
      (cRows || []).forEach((c) => {
        if (!checkinMap[c.habit_id]) checkinMap[c.habit_id] = [];
        checkinMap[c.habit_id].push(c.date);
      });

      habits = hRows.map((h) => ({
        id: h.id,
        name: h.name,
        period: h.period,
        startDate: h.start_date,
        checkedDays: checkinMap[h.id] || [],
        resultShown: h.result_shown || false,
      }));
      // Sync to localStorage as offline cache
      localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
      return;
    }
  }
  // Fallback to localStorage
  habits = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

async function saveHabit(habit) {
  // Always save to localStorage
  const idx = habits.findIndex((h) => h.id === habit.id);
  if (idx >= 0) habits[idx] = habit;
  else habits.push(habit);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));

  if (useCloud && currentUser) {
    await sb.from("habits").upsert({
      id: habit.id,
      user_id: currentUser.id,
      name: habit.name,
      period: habit.period,
      start_date: habit.startDate,
      result_shown: habit.resultShown || false,
    });
  }
}

async function deleteHabitFromDB(id) {
  habits = habits.filter((h) => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));

  if (useCloud && currentUser) {
    await sb.from("checkins").delete().eq("habit_id", id);
    await sb.from("habits").delete().eq("id", id);
  }
}

async function saveCheckin(habitId, date) {
  if (useCloud && currentUser) {
    await sb.from("checkins").upsert({
      habit_id: habitId,
      user_id: currentUser.id,
      date: date,
    });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

// --- PKCE Utilities ---
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes) {
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- X OAuth ---
async function startXOAuth() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  sessionStorage.setItem("x_code_verifier", codeVerifier);
  sessionStorage.setItem("x_oauth_state", state);

  const redirectUri = `${window.location.origin}/callback.html`;
  const scopes = "tweet.read tweet.write users.read offline.access";

  const authUrl =
    `https://x.com/i/oauth2/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(X_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256`;

  window.location.href = authUrl;
}

async function checkXConnection() {
  try {
    const { data } = await sb
      .from("x_tokens")
      .select("x_username")
      .eq("user_id", getDeviceId())
      .maybeSingle();

    if (data) {
      xConnected = true;
      xUsername = data.x_username || "";
    } else {
      xConnected = false;
      xUsername = "";
    }
  } catch {
    xConnected = false;
    xUsername = "";
  }
  updateXButton();
}

async function disconnectX() {
  const msg = lang === "ja" ? "X連携を解除しますか？" : "Disconnect X account?";
  if (!confirm(msg)) return;

  await sb.from("x_tokens").delete().eq("user_id", getDeviceId());
  xConnected = false;
  xUsername = "";
  updateXButton();
  render();
}

function updateXButton() {
  const btn = document.getElementById("xConnectBtn");
  if (!btn) return;
  if (xConnected) {
    btn.textContent = xUsername ? `𝕏 @${xUsername}` : "𝕏 ✓";
    btn.title = lang === "ja" ? "クリックして連携解除" : "Click to disconnect";
  } else {
    btn.textContent = lang === "ja" ? "𝕏 連携" : "𝕏 Connect";
    btn.title = lang === "ja" ? "Xアカウントを連携" : "Connect X account";
  }
}

function composeTweet(habit) {
  const streak = getStreak(habit);
  const { totalDays, elapsed, checked } = getProgress(habit);
  const rate = elapsed > 0 ? Math.round((checked / elapsed) * 100) : 0;

  let text;
  if (lang === "ja") {
    text = `【習慣チャレンジ中】\n`;
    text += `📋 ${habit.name}\n`;
    text += streak > 0 ? `🔥 ${streak}日連続達成!\n` : "";
    text += `📊 達成率: ${rate}% (${checked}/${elapsed}日)\n`;
    text += `💪 #三日坊主バスター で習慣化に挑戦中!\n`;
  } else {
    text = `【Habit Challenge】\n`;
    text += `📋 ${habit.name}\n`;
    text += streak > 0 ? `🔥 ${streak}-day streak!\n` : "";
    text += `📊 Rate: ${rate}% (${checked}/${elapsed}d)\n`;
    text += `💪 Building habits with #HabitBuster!\n`;
  }
  text += SITE_URL;
  return text;
}

function postToX(habitId) {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;

  const draft = composeTweet(habit);
  const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(draft)}`;
  window.open(intentUrl, "_blank", "width=550,height=420");
}

// --- Helpers ---
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dateDiffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function getStreak(habit) {
  let streak = 0;
  const today = todayStr();
  let d = new Date(today);
  if (habit.checkedDays.includes(today)) {
    streak = 1;
    d.setDate(d.getDate() - 1);
  } else {
    d.setDate(d.getDate() - 1);
  }
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (ds < habit.startDate) break;
    if (habit.checkedDays.includes(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getProgress(habit) {
  const today = todayStr();
  const endDate = getEndDate(habit);
  const totalDays = habit.period;
  const elapsed = Math.min(dateDiffDays(habit.startDate, today) + 1, totalDays);
  const checked = habit.checkedDays.filter(
    (d) => d >= habit.startDate && d <= endDate
  ).length;
  return { totalDays, elapsed, checked };
}

function getEndDate(habit) {
  const start = new Date(habit.startDate);
  start.setDate(start.getDate() + habit.period - 1);
  return start.toISOString().slice(0, 10);
}

function isExpired(habit) {
  return todayStr() > getEndDate(habit);
}

function isTodayChecked(habit) {
  return habit.checkedDays.includes(todayStr());
}

function daysLeft(habit) {
  const end = getEndDate(habit);
  const diff = dateDiffDays(todayStr(), end);
  return Math.max(0, diff);
}

// --- Render ---
function render() {
  applyI18n();
  renderDate();
  renderHabits();
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (i18n[lang][key]) el.textContent = i18n[lang][key];
  });
  document.getElementById("langToggle").textContent = lang === "ja" ? "EN" : "JA";
  document.getElementById("habitNameInput").placeholder =
    lang === "ja" ? "例: 毎日走る" : "e.g. Run every day";
  document.getElementById("customDays").placeholder =
    lang === "ja" ? "カスタム" : "Custom";
  document.getElementById("customDeposit").placeholder =
    lang === "ja" ? "カスタム" : "Custom";
}

function renderDate() {
  const today = new Date();
  document.getElementById("todayDate").textContent =
    lang === "ja"
      ? `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日（${["日","月","火","水","木","金","土"][today.getDay()]}）`
      : today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function renderHabits() {
  const list = document.getElementById("habitList");
  const empty = document.getElementById("emptyState");

  habits.forEach((h) => {
    if (isExpired(h) && !h.resultShown) {
      showResult(h);
      h.resultShown = true;
      saveHabit(h);
    }
  });

  const active = habits.filter((h) => !isExpired(h));
  const expired = habits.filter((h) => isExpired(h));

  if (habits.length === 0) {
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  list.innerHTML = [...active, ...expired].map((h) => renderCard(h)).join("");
  attachCardEvents();
}

function renderCard(habit) {
  const streak = getStreak(habit);
  const { totalDays, elapsed, checked } = getProgress(habit);
  const expired = isExpired(habit);
  const todayDone = isTodayChecked(habit);
  const left = daysLeft(habit);
  const rate = elapsed > 0 ? Math.round((checked / elapsed) * 100) : 0;
  const progressPct = Math.round((elapsed / totalDays) * 100);
  const progressClass = expired ? (rate >= 80 ? "success" : "danger") : "";

  let btnClass, btnText;
  if (expired) {
    btnClass = rate >= 80 ? "done" : "expired";
    btnText = rate >= 80 ? t("resultSuccess") : t("resultFail");
  } else if (todayDone) {
    btnClass = "done";
    btnText = t("done") + " ✓";
  } else {
    btnClass = "undone";
    btnText = t("checkIn");
  }

  return `
    <div class="habit-card" data-id="${habit.id}" ${expired ? 'style="opacity:.6"' : ""}>
      <div class="habit-card-header">
        <h3>${escHtml(habit.name)}</h3>
        <div class="dropdown">
          <button class="btn-menu" data-toggle="dropdown">⋯</button>
          <div class="dropdown-menu">
            ${!expired ? `<button data-action="edit">${t("edit")}</button>` : ""}
            <button data-action="delete" class="danger">${t("delete")}</button>
          </div>
        </div>
      </div>
      <div class="habit-meta">
        ${streak > 0 ? `<span class="streak-badge">🔥 ${streak}${t("streak")}</span>` : ""}
        <span>📅 ${left}${t("dayLeft")}</span>
        <span>${t("rate")}: ${rate}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${progressClass}" style="width:${progressPct}%"></div>
      </div>
      <div class="habit-actions">
        <button class="btn-check ${btnClass}" ${todayDone || expired ? "disabled" : ""} data-action="check">
          ${btnText}
        </button>
        ${!expired ? `<button class="btn-x-post" data-action="xpost" title="${t("xPost")}">𝕏</button>` : ""}
      </div>
    </div>
  `;
}

function escHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// --- Events ---
function attachCardEvents() {
  document.querySelectorAll("[data-toggle='dropdown']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      document.querySelectorAll(".dropdown-menu.show").forEach((m) => {
        if (m !== menu) m.classList.remove("show");
      });
      menu.classList.toggle("show");
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".dropdown-menu.show").forEach((m) => m.classList.remove("show"));
  });

  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const card = btn.closest(".habit-card");
      const id = card?.dataset.id;
      const action = btn.dataset.action;
      if (action === "check") checkIn(id);
      else if (action === "edit") openEdit(id);
      else if (action === "delete") deleteHabit(id);
      else if (action === "xpost") postToX(id);
    });
  });
}

async function checkIn(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit || isTodayChecked(habit) || isExpired(habit)) return;

  habit.checkedDays.push(todayStr());
  await saveCheckin(id, todayStr());
  render();

  const praises = t("praise");
  const msg = praises[Math.floor(Math.random() * praises.length)];
  showToast(msg);

  const streak = getStreak(habit);
  const milestones = i18n[lang].milestones;
  if (milestones[streak]) {
    setTimeout(() => showToast(milestones[streak]), 1500);
  }
}

function showToast(msg) {
  const toast = document.getElementById("praiseToast");
  toast.textContent = msg;
  toast.hidden = false;
  requestAnimationFrame(() => {
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => (toast.hidden = true), 300);
    }, 2000);
  });
}

// --- Modal ---
const modal = document.getElementById("habitModal");
const form = document.getElementById("habitForm");
let selectedDays = null;

document.getElementById("addHabitBtn").addEventListener("click", () => openAdd());
document.getElementById("modalCancel").addEventListener("click", () => closeModal());
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

function openAdd() {
  editingId = null;
  document.getElementById("modalTitle").textContent = t("addHabit");
  form.reset();
  selectedDays = null;
  updateOptionBtns();
  modal.hidden = false;
}

function openEdit(id) {
  const h = habits.find((h) => h.id === id);
  if (!h) return;
  editingId = id;
  document.getElementById("modalTitle").textContent = t("editHabit");
  document.getElementById("habitNameInput").value = h.name;

  const stdDays = [7, 14, 30];
  if (stdDays.includes(h.period)) {
    selectedDays = h.period;
    document.getElementById("customDays").value = "";
  } else {
    selectedDays = null;
    document.getElementById("customDays").value = h.period;
  }

  updateOptionBtns();
  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
  editingId = null;
}

document.querySelectorAll(".period-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedDays = Number(btn.dataset.days);
    document.getElementById("customDays").value = "";
    updateOptionBtns();
  });
});

document.getElementById("customDays").addEventListener("input", () => {
  selectedDays = null;
  updateOptionBtns();
});

function updateOptionBtns() {
  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.days) === selectedDays);
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("habitNameInput").value.trim();
  if (!name) return;

  const days = selectedDays || Number(document.getElementById("customDays").value);

  if (!days || days < 1) return alert(lang === "ja" ? "期間を設定してください" : "Set a period");

  if (editingId) {
    const h = habits.find((h) => h.id === editingId);
    if (h) {
      h.name = name;
      h.period = days;
      await saveHabit(h);
    }
  } else {
    const newHabit = {
      id: crypto.randomUUID(),
      name,
      period: days,
      startDate: todayStr(),
      checkedDays: [],
      resultShown: false,
    };
    await saveHabit(newHabit);
  }

  closeModal();
  render();
});

async function deleteHabit(id) {
  if (!confirm(t("deleteConfirm"))) return;
  await deleteHabitFromDB(id);
  render();
}

// --- Result Modal ---
function showResult(habit) {
  const { totalDays, checked } = getProgress(habit);
  const rate = totalDays > 0 ? Math.round((checked / totalDays) * 100) : 0;
  const success = rate >= 80;

  const rModal = document.getElementById("resultModal");
  document.getElementById("resultTitle").textContent = success ? t("resultSuccess") : t("resultFail");
  document.getElementById("resultBody").innerHTML = `
    <div class="result-icon">${success ? "🎉" : "😢"}</div>
    <div class="result-stats">
      <strong>${habit.name}</strong><br>
      ${t("rate")}: ${rate}% (${checked}/${totalDays}${t("days")})
    </div>
  `;
  rModal.hidden = false;
}

document.getElementById("resultClose").addEventListener("click", () => {
  document.getElementById("resultModal").hidden = true;
});
document.getElementById("resultModal").addEventListener("click", (e) => {
  if (e.target.id === "resultModal") document.getElementById("resultModal").hidden = true;
});

// --- Language Toggle ---
document.getElementById("langToggle").addEventListener("click", () => {
  lang = lang === "ja" ? "en" : "ja";
  localStorage.setItem("hb_lang", lang);
  render();
});

// --- X Button Event ---
document.getElementById("xConnectBtn").addEventListener("click", () => {
  if (xConnected) {
    disconnectX();
  } else {
    startXOAuth();
  }
});

// --- Init ---
(async () => {
  await initAuth();
  await loadHabits();
  await checkXConnection();
  render();
})();
