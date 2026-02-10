// ============================================================
// 三日坊主バスター - app.js
// ============================================================

// --- i18n ---
const i18n = {
  ja: {
    appName: "三日坊主バスター",
    subtitle: "習慣を守れなかったら、デポジット没収!",
    addHabit: "+ 習慣を追加",
    editHabit: "習慣を編集",
    habitName: "習慣名",
    challengePeriod: "チャレンジ期間",
    depositAmount: "デポジット金額（擬似）",
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
    deposit: "デポジット",
    rate: "達成率",
    resultSuccess: "チャレンジ成功!",
    resultFail: "チャレンジ失敗...",
    depositSaved: "デポジットを守りました!",
    depositLost: "デポジットが寄付されました",
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
  },
  en: {
    appName: "Habit Buster",
    subtitle: "Miss your habit? Lose your deposit!",
    addHabit: "+ Add Habit",
    editHabit: "Edit Habit",
    habitName: "Habit Name",
    challengePeriod: "Challenge Period",
    depositAmount: "Deposit Amount (mock)",
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
    deposit: "Deposit",
    rate: "Rate",
    resultSuccess: "Challenge Complete!",
    resultFail: "Challenge Failed...",
    depositSaved: "Your deposit is safe!",
    depositLost: "Your deposit was donated",
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
  },
};

let lang = localStorage.getItem("hb_lang") || "ja";
const t = (key) => i18n[lang][key] || key;

// --- State ---
const STORAGE_KEY = "hb_habits";
let habits = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let editingId = null;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
}

// --- Helpers ---
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dateDiffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (lang === "ja") {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function getStreak(habit) {
  let streak = 0;
  const today = todayStr();
  let d = new Date(today);
  // If checked in today, count today
  if (habit.checkedDays.includes(today)) {
    streak = 1;
    d.setDate(d.getDate() - 1);
  } else {
    // check from yesterday
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

  // Check for expired habits and show results
  habits.forEach((h) => {
    if (isExpired(h) && !h.resultShown) {
      showResult(h);
      h.resultShown = true;
      save();
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
        <span>💰 ¥${habit.deposit.toLocaleString()}</span>
        <span>${t("rate")}: ${rate}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${progressClass}" style="width:${progressPct}%"></div>
      </div>
      <div class="habit-actions">
        <button class="btn-check ${btnClass}" ${todayDone || expired ? "disabled" : ""} data-action="check">
          ${btnText}
        </button>
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
  // Dropdown toggle
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

  // Close dropdowns on outside click
  document.addEventListener("click", () => {
    document.querySelectorAll(".dropdown-menu.show").forEach((m) => m.classList.remove("show"));
  });

  // Card actions
  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const card = btn.closest(".habit-card");
      const id = card?.dataset.id;
      const action = btn.dataset.action;
      if (action === "check") checkIn(id);
      else if (action === "edit") openEdit(id);
      else if (action === "delete") deleteHabit(id);
    });
  });
}

function checkIn(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit || isTodayChecked(habit) || isExpired(habit)) return;

  habit.checkedDays.push(todayStr());
  save();
  render();

  // Praise
  const praises = t("praise");
  const msg = praises[Math.floor(Math.random() * praises.length)];
  showToast(msg);

  // Milestone check
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
let selectedDeposit = null;

document.getElementById("addHabitBtn").addEventListener("click", () => openAdd());
document.getElementById("modalCancel").addEventListener("click", () => closeModal());
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

function openAdd() {
  editingId = null;
  document.getElementById("modalTitle").textContent = t("addHabit");
  form.reset();
  selectedDays = null;
  selectedDeposit = null;
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

  const stdDep = [1000, 3000, 5000];
  if (stdDep.includes(h.deposit)) {
    selectedDeposit = h.deposit;
    document.getElementById("customDeposit").value = "";
  } else {
    selectedDeposit = null;
    document.getElementById("customDeposit").value = h.deposit;
  }

  updateOptionBtns();
  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
  editingId = null;
}

// Period / Deposit button selection
document.querySelectorAll(".period-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedDays = Number(btn.dataset.days);
    document.getElementById("customDays").value = "";
    updateOptionBtns();
  });
});

document.querySelectorAll(".deposit-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedDeposit = Number(btn.dataset.amount);
    document.getElementById("customDeposit").value = "";
    updateOptionBtns();
  });
});

document.getElementById("customDays").addEventListener("input", () => {
  selectedDays = null;
  updateOptionBtns();
});

document.getElementById("customDeposit").addEventListener("input", () => {
  selectedDeposit = null;
  updateOptionBtns();
});

function updateOptionBtns() {
  document.querySelectorAll(".period-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.days) === selectedDays);
  });
  document.querySelectorAll(".deposit-btn").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.amount) === selectedDeposit);
  });
}

// Form submit
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("habitNameInput").value.trim();
  if (!name) return;

  const days = selectedDays || Number(document.getElementById("customDays").value);
  const deposit = selectedDeposit ?? Number(document.getElementById("customDeposit").value);

  if (!days || days < 1) return alert(lang === "ja" ? "期間を設定してください" : "Set a period");
  if (deposit == null || deposit < 0) return alert(lang === "ja" ? "金額を設定してください" : "Set an amount");

  if (editingId) {
    const h = habits.find((h) => h.id === editingId);
    if (h) {
      h.name = name;
      h.period = days;
      h.deposit = deposit;
    }
  } else {
    habits.push({
      id: crypto.randomUUID(),
      name,
      period: days,
      deposit,
      startDate: todayStr(),
      checkedDays: [],
      resultShown: false,
    });
  }

  save();
  closeModal();
  render();
});

// Delete
function deleteHabit(id) {
  if (!confirm(t("deleteConfirm"))) return;
  habits = habits.filter((h) => h.id !== id);
  save();
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
      ${t("rate")}: ${rate}% (${checked}/${totalDays}${t("days")})<br>
      ${t("deposit")}: ¥${habit.deposit.toLocaleString()}
    </div>
    <div class="result-message ${success ? "success" : "fail"}">
      ${success ? t("depositSaved") : t("depositLost")}
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

// --- Init ---
render();
