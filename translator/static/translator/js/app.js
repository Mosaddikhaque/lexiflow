/* ============================================
   LEXIFLOW — Main Application JS
   ============================================ */

"use strict";

// ─── State ───────────────────────────────────
const State = {
  isTranslating: false,
  isDictLoading: false,
  dictHistory: JSON.parse(localStorage.getItem("lf_history") || "[]"),
  currentAudio: null,
};

// ─── DOM Refs ─────────────────────────────────
const $ = (id) => document.getElementById(id);

// ─── Tab System ───────────────────────────────
function switchTab(tabId, btn) {
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-tab").forEach((b) => b.classList.remove("active"));
  $("tab-" + tabId).classList.add("active");
  btn.classList.add("active");
}

// ─── Translator ───────────────────────────────
function updateCharCount() {
  const len = $("sourceText").value.length;
  const el = $("charCount");
  el.textContent = `${len} / 5000`;
  el.className = "char-count" + (len > 4500 ? " danger" : len > 4000 ? " warn" : "");
}

function clearSource() {
  $("sourceText").value = "";
  updateCharCount();
  $("outputArea").textContent = "Translation appears here…";
  $("outputArea").className = "output-area empty";
  $("outputMeta").textContent = "";
}

async function pasteText() {
  try {
    const text = await navigator.clipboard.readText();
    $("sourceText").value = text;
    updateCharCount();
    toast("Pasted from clipboard", "info");
  } catch {
    toast("Paste failed — use Ctrl+V", "error");
  }
}

async function copyOutput() {
  const text = $("outputArea").textContent;
  if (!text || $("outputArea").classList.contains("empty")) return;
  try {
    await navigator.clipboard.writeText(text);
    const btn = $("copyOutputBtn");
    btn.classList.add("copied");
    btn.innerHTML = iconCheck();
    toast("Copied to clipboard!", "success");
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.innerHTML = iconCopy();
    }, 2000);
  } catch {
    toast("Copy failed", "error");
  }
}

function speakText(textId, langId) {
  const text = textId === "output"
    ? $("outputArea").textContent
    : $("sourceText").value;
  const lang = langId === "target"
    ? $("targetLang").value
    : $("sourceLang").value;

  if (!text || (textId === "output" && $("outputArea").classList.contains("empty"))) return;

  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang === "auto" ? "en" : lang;
  utt.rate = 0.95;
  window.speechSynthesis.speak(utt);
  toast("Speaking…", "info");
}

function swapLanguages() {
  const src = $("sourceLang");
  const tgt = $("targetLang");
  if (src.value === "auto") { toast("Cannot swap Auto Detect", "error"); return; }

  [src.value, tgt.value] = [tgt.value, src.value];

  const srcText = $("sourceText").value;
  const outText = $("outputArea").textContent;
  if (!$("outputArea").classList.contains("empty") && outText) {
    $("sourceText").value = outText;
    updateCharCount();
  }

  syncQuickChips();
  toast("Languages swapped", "info");
}

function quickLang(el) {
  document.querySelectorAll(".lang-chip").forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  $("targetLang").value = el.dataset.lang;
}

function syncQuickChips() {
  const tgtVal = $("targetLang").value;
  document.querySelectorAll(".lang-chip").forEach((c) => {
    c.classList.toggle("active", c.dataset.lang === tgtVal);
  });
}

async function doTranslate() {
  const text = $("sourceText").value.trim();
  if (!text) { toast("Please enter some text", "error"); return; }
  if (State.isTranslating) return;

  State.isTranslating = true;
  const btn = $("translateBtn");
  btn.classList.add("loading");
  btn.disabled = true;

  $("outputArea").className = "output-area empty";
  $("outputArea").textContent = "";

  try {
    const res = await fetch("/api/translate/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source: $("sourceLang").value,
        target: $("targetLang").value,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Translation failed");

    $("outputArea").textContent = data.translated;
    $("outputArea").className = "output-area";
    $("outputMeta").textContent = `${data.translated_count} chars`;
    toast("Translated successfully ✦", "success");

  } catch (err) {
    toast(err.message, "error");
    $("outputArea").textContent = "Translation failed. Please try again.";
    $("outputArea").className = "output-area empty";
  } finally {
    State.isTranslating = false;
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

// ─── Dictionary ───────────────────────────────
async function lookupWord() {
  const word = $("dictInput").value.trim();
  if (!word) { toast("Enter a word to look up", "error"); return; }
  if (word.includes(" ")) { toast("Dictionary works for single words only", "error"); return; }
  if (State.isDictLoading) return;

  State.isDictLoading = true;
  const btn = $("dictBtn");
  btn.disabled = true;

  $("dictResultArea").innerHTML = buildSkeleton();

  try {
    const res = await fetch("/api/dictionary/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Word not found");

    renderDictResult(data);
    saveHistory({ word: data.word, pos: data.meanings[0]?.partOfSpeech || "" });

  } catch (err) {
    $("dictResultArea").innerHTML = `
      <div class="dict-empty">
        <span class="empty-icon">🔍</span>
        <h3>Not Found</h3>
        <p>${err.message}</p>
      </div>`;
  } finally {
    State.isDictLoading = false;
    btn.disabled = false;
  }
}

function renderDictResult(d) {
  const posClass = (pos) => {
    const m = { noun:"noun", verb:"verb", adjective:"adjective", adverb:"adverb" };
    return m[pos.toLowerCase()] || "other";
  };

  const audio = d.audio ? `
    <button class="audio-play-btn" onclick="playAudio('${d.audio}')">
      ${iconVolume()} Pronounce
    </button>` : "";

  const origin = d.origin ? `<div class="word-origin">Origin: ${d.origin}</div>` : "";

  let meaningsHtml = d.meanings.map(m => `
    <div class="meaning-card">
      <div class="meaning-header">
        <span class="pos-pill ${posClass(m.partOfSpeech)}">${m.partOfSpeech}</span>
        <div class="meaning-line"></div>
      </div>
      <div class="definitions-list">
        ${m.definitions.map((def, i) => `
          <div class="def-row">
            <span class="def-index">${String(i+1).padStart(2,"0")}</span>
            <div class="def-body">
              <div class="def-text">${def.definition}</div>
              ${def.example ? `<div class="def-example">${def.example}</div>` : ""}
            </div>
          </div>`).join("")}
      </div>
    </div>`).join("");

  const syns = d.synonyms.length ? `
    <div class="tag-card synonyms">
      <div class="tag-card-title">Synonyms</div>
      <div class="tag-pills">
        ${d.synonyms.map(s => `<span class="tag-pill" onclick="lookupFromTag('${s}')">${s}</span>`).join("")}
      </div>
    </div>` : "";

  const ants = d.antonyms.length ? `
    <div class="tag-card antonyms">
      <div class="tag-card-title">Antonyms</div>
      <div class="tag-pills">
        ${d.antonyms.map(a => `<span class="tag-pill" onclick="lookupFromTag('${a}')">${a}</span>`).join("")}
      </div>
    </div>` : "";

  const tagsHtml = (syns || ants) ? `<div class="word-tags-section">${syns}${ants}</div>` : "";

  $("dictResultArea").innerHTML = `
    <div class="dict-result">
      <div class="word-banner">
        <div class="word-info">
          <div class="word-main">${d.word}</div>
          ${d.phonetic ? `<div class="word-phonetic">${d.phonetic}</div>` : ""}
          ${origin}
        </div>
        <div class="word-actions">
          ${audio}
          <button class="copy-word-btn" onclick="copyToClip('${d.word}')">
            ${iconCopy()} Copy
          </button>
        </div>
      </div>
      <div class="meanings-grid">${meaningsHtml}</div>
      ${tagsHtml}
    </div>`;
}

function playAudio(url) {
  if (!url) return;
  if (State.currentAudio) { State.currentAudio.pause(); }
  const fullUrl = url.startsWith("//") ? "https:" + url : url;
  State.currentAudio = new Audio(fullUrl);
  State.currentAudio.play().catch(() => toast("Audio unavailable", "error"));
}

async function copyToClip(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`"${text}" copied!`, "success");
  } catch { toast("Copy failed", "error"); }
}

function lookupFromTag(word) {
  $("dictInput").value = word;
  lookupWord();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ─── History ──────────────────────────────────
function saveHistory(entry) {
  State.dictHistory = [entry, ...State.dictHistory.filter(h => h.word !== entry.word)].slice(0, 15);
  localStorage.setItem("lf_history", JSON.stringify(State.dictHistory));
  renderHistory();
}

function renderHistory() {
  const container = $("historyItems");
  if (!container) return;

  if (!State.dictHistory.length) {
    container.innerHTML = `<div class="history-empty">No recent searches yet</div>`;
    return;
  }

  container.innerHTML = State.dictHistory.map((h, i) => `
    <div class="history-item" onclick="lookupFromTag('${h.word}')">
      <div>
        <div class="hw">${h.word}</div>
        ${h.pos ? `<div class="hp">${h.pos}</div>` : ""}
      </div>
      <button class="del-hist" onclick="deleteHist(event,${i})">✕</button>
    </div>`).join("");
}

function deleteHist(e, i) {
  e.stopPropagation();
  State.dictHistory.splice(i, 1);
  localStorage.setItem("lf_history", JSON.stringify(State.dictHistory));
  renderHistory();
}

function clearAllHistory() {
  State.dictHistory = [];
  localStorage.removeItem("lf_history");
  renderHistory();
  toast("History cleared", "info");
}

// ─── Skeleton Loader ──────────────────────────
function buildSkeleton() {
  return `
    <div style="padding:8px 0; display:flex; flex-direction:column; gap:14px;">
      <div class="skeleton" style="height:96px; border-radius:18px;"></div>
      <div class="skeleton" style="height:130px; border-radius:14px;"></div>
      <div class="skeleton" style="height:110px; border-radius:14px;"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div class="skeleton" style="height:80px; border-radius:14px;"></div>
        <div class="skeleton" style="height:80px; border-radius:14px;"></div>
      </div>
    </div>`;
}

// ─── Toast ────────────────────────────────────
function toast(msg, type = "success") {
  const container = $("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type}`;

  const icons = { success: iconCheck(), error: iconX(), info: iconInfo() };
  el.innerHTML = `${icons[type] || ""}<span>${msg}</span>`;
  container.appendChild(el);

  requestAnimationFrame(() => el.classList.add("show"));

  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 400);
  }, 3000);
}

// ─── SVG Icons ────────────────────────────────
const iconCheck = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
const iconX     = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const iconInfo  = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
const iconCopy  = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
const iconVolume= () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>`;

// ─── Keyboard Shortcuts ───────────────────────
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    const panel = document.querySelector(".tab-panel.active");
    if (panel?.id === "tab-translate") doTranslate();
    if (panel?.id === "tab-dictionary") lookupWord();
  }
  if (e.key === "Escape") window.speechSynthesis.cancel();
});

// ─── Init ─────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  updateCharCount();
});