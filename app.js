const config = window.RAG_CHATBOT_CONFIG || { routes: [] };
const routes = Array.isArray(config.routes) ? config.routes : [];
const orchestrator =
  config && typeof config === "object" && config.orchestrator && typeof config.orchestrator === "object"
    ? config.orchestrator
    : {};
const orchestratorUrl =
  typeof orchestrator.function_url === "string" ? orchestrator.function_url.trim() : "";
const orchestratorName =
  typeof orchestrator.function_name === "string" ? orchestrator.function_name.trim() : "";
const analytics =
  config && typeof config === "object" && config.analytics && typeof config.analytics === "object"
    ? config.analytics
    : {};
const googleTagId =
  typeof analytics.google_tag_id === "string" ? analytics.google_tag_id.trim() : "";
let analyticsEnabled = false;

const composer = document.getElementById("composer");
const queryInput = document.getElementById("queryInput");
const sendButton = document.getElementById("sendButton");
const statusText = document.getElementById("statusText");
const chatLog = document.getElementById("chatLog");
const footerYear = document.getElementById("footerYear");
const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel = document.getElementById("settingsPanel");
const toggleRoutingMeta = document.getElementById("toggleRoutingMeta");
const themeSelect = document.getElementById("themeSelect");
const rootElement = document.documentElement;
const pageBody = document.body;
let statusCycleTimer = null;
let statusCycleRunId = 0;
let chatScrollRafId = null;
const ROUTING_META_HIDDEN_CLASS = "hide-routing-meta";
const ROUTING_META_STORAGE_KEY = "calquery-routing-meta-visible";
const THEME_STORAGE_KEY = "calquery-theme";
const THEME_DEFAULT = "default";
const THEME_KANAGAWA = "kanagawa";
const THEME_GRUVBOX_DARK = "gruvbox-dark";
const SUPPORTED_THEMES = new Set([THEME_DEFAULT, THEME_KANAGAWA, THEME_GRUVBOX_DARK]);
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into",
  "is", "it", "its", "of", "on", "or", "that", "the", "their", "this", "to",
  "what", "which", "with", "how", "does", "say", "key", "themes", "summarize",
  "compare", "list", "notable", "entries", "index",
]);
const STARTER_QUERY_MESSAGE_DELAY_MS = 7000;
const STARTER_QUERY_DISPLAY_COUNT = 3;
const STARTER_QUERIES = [
  "How do I file a small claims case?",
  "What happens after I file a lawsuit?",
  "How do I respond to a court summons?",
  "What is the difference between civil and criminal court?",
  "How do I prepare for a court hearing?",
  "What documents do I need to start a case?",
  "What happens if I miss a court deadline?",
  "How do court filing fees work?",
  "What does \"motion\" mean in court?",
  "How long does a court case usually take?",
];

if (footerYear) {
  footerYear.textContent = String(new Date().getFullYear());
}

function hasGoogleTagConfig(tagId) {
  if (!Array.isArray(window.dataLayer) || !tagId) {
    return false;
  }
  return window.dataLayer.some((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    return entry[0] === "config" && entry[1] === tagId;
  });
}

function initializeAnalytics() {
  if (!googleTagId) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }

  const scriptSrc = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`;
  if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = scriptSrc;
    document.head.appendChild(script);
  }

  if (!hasGoogleTagConfig(googleTagId)) {
    window.gtag("js", new Date());
    window.gtag("config", googleTagId);
  }
  analyticsEnabled = true;
}

function trackEvent(name, params = {}) {
  if (!analyticsEnabled || typeof window.gtag !== "function" || !name) {
    return;
  }
  window.gtag("event", name, params);
}

function classifyErrorType(error) {
  const message = String((error && error.message) || error || "").toLowerCase();
  if (!message) {
    return "unknown";
  }
  if (message.includes("missing orchestrator")) {
    return "missing_orchestrator";
  }
  if (message.includes("request failed")) {
    return "request_failed";
  }
  if (message.includes("non-json response")) {
    return "invalid_json";
  }
  if (message.includes("unexpected orchestrator response")) {
    return "unexpected_payload";
  }
  return "other";
}

initializeAnalytics();

function setProcessingBackground(isActive) {
  if (!pageBody) {
    return;
  }
  pageBody.classList.toggle("is-processing", Boolean(isActive));
}

function setStatusProcessingAnimation(isActive) {
  if (!statusText) {
    return;
  }
  statusText.classList.toggle("is-processing", Boolean(isActive));
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderMarkdown(markdown) {
  const escaped = escapeHtml(String(markdown || "")).replace(/\r\n?/g, "\n");
  const codeBlocks = [];

  let working = escaped.replace(/```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g, (_match, language, code) => {
    const idx = codeBlocks.length;
    const className = language ? ` class="language-${language}"` : "";
    codeBlocks.push(`<pre><code${className}>${code}</code></pre>`);
    return `@@CODEBLOCK_${idx}@@`;
  });

  working = working
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  const parts = [];
  const listStack = [];

  function openList(type, startNumber = null) {
    if (type === "ol") {
      if (typeof startNumber === "number" && Number.isFinite(startNumber) && startNumber > 1) {
        parts.push(`<ol start="${startNumber}">`);
      } else {
        parts.push("<ol>");
      }
    } else {
      parts.push("<ul>");
    }
    listStack.push({ type, liOpen: false });
  }

  function closeCurrentListItem() {
    const current = listStack[listStack.length - 1];
    if (!current || !current.liOpen) {
      return;
    }
    parts.push("</li>");
    current.liOpen = false;
  }

  function closeCurrentList() {
    const current = listStack[listStack.length - 1];
    if (!current) {
      return;
    }
    closeCurrentListItem();
    parts.push(`</${current.type}>`);
    listStack.pop();
  }

  function closeListsToDepth(targetDepth) {
    while (listStack.length > targetDepth) {
      closeCurrentList();
    }
  }

  function closeLists() {
    closeListsToDepth(0);
  }

  function addListItem(type, content, indent, startNumber = null) {
    let targetDepth = Math.floor(Math.max(0, indent) / 2) + 1;
    const currentDepth = listStack.length;

    // Heuristic: keep "-" items nested under an active numbered item even when
    // the model omits indentation after the first nested bullet.
    const topList = listStack[currentDepth - 1];
    const parentList = listStack[currentDepth - 2];
    if (type === "ul" && targetDepth === 1) {
      if (topList && topList.type === "ol" && topList.liOpen) {
        targetDepth = currentDepth + 1;
      } else if (
        topList &&
        topList.type === "ul" &&
        parentList &&
        parentList.type === "ol"
      ) {
        targetDepth = currentDepth;
      }
    }

    if (targetDepth > currentDepth + 1) {
      targetDepth = currentDepth + 1;
    }

    if (targetDepth > 1) {
      const parent = listStack[targetDepth - 2];
      if (!parent || !parent.liOpen) {
        targetDepth = Math.max(1, currentDepth);
      }
    }

    if (targetDepth <= currentDepth) {
      closeListsToDepth(targetDepth);
      closeCurrentListItem();

      const active = listStack[listStack.length - 1];
      if (active && active.type !== type) {
        closeCurrentList();
      }
    }

    if (targetDepth > listStack.length) {
      openList(type, type === "ol" ? startNumber : null);
    } else if (!listStack.length || listStack[listStack.length - 1].type !== type) {
      openList(type, type === "ol" ? startNumber : null);
    }

    const active = listStack[listStack.length - 1];
    parts.push(`<li>${content}`);
    active.liOpen = true;
  }

  for (const rawLine of working.split("\n")) {
    const normalizedLine = rawLine.replace(/\t/g, "    ");
    const trimmed = normalizedLine.trim();
    const indentMatch = normalizedLine.match(/^ +/);
    const indent = indentMatch ? indentMatch[0].length : 0;

    if (!trimmed) {
      // Preserve list context across blank lines so "1." lists with nested bullets
      // don't get split into separate ordered lists that restart numbering.
      continue;
    }

    const codeMatch = trimmed.match(/^@@CODEBLOCK_(\d+)@@$/);
    if (codeMatch) {
      closeLists();
      const idx = Number.parseInt(codeMatch[1], 10);
      parts.push(codeBlocks[idx] || "");
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      parts.push(`<h${level}>${headingMatch[2]}</h${level}>`);
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      const startingNumber = Number.parseInt(orderedMatch[1], 10);
      addListItem("ol", orderedMatch[2], indent, startingNumber);
      continue;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      addListItem("ul", unorderedMatch[1], indent);
      continue;
    }

    closeLists();
    parts.push(`<p>${trimmed}</p>`);
  }

  closeLists();
  return parts.join("") || `<p>${escaped}</p>`;
}

function smoothScrollChatTo(targetTop, durationMs, onComplete) {
  if (chatScrollRafId !== null) {
    cancelAnimationFrame(chatScrollRafId);
    chatScrollRafId = null;
  }

  const startTop = chatLog.scrollTop;
  const delta = targetTop - startTop;
  if (Math.abs(delta) < 1) {
    chatLog.scrollTop = targetTop;
    return;
  }

  const startTime = performance.now();
  const total = Math.max(200, Number(durationMs) || 900);

  function easeInOutSine(progress) {
    return 0.5 - Math.cos(Math.PI * progress) / 2;
  }

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / total);
    chatLog.scrollTop = startTop + delta * easeInOutSine(progress);

    if (progress < 1) {
      chatScrollRafId = requestAnimationFrame(tick);
      return;
    }
    chatScrollRafId = null;
    if (typeof onComplete === "function") {
      onComplete();
    }
  }

  chatScrollRafId = requestAnimationFrame(tick);
}

function targetTopForMessage(message, topOffset) {
  const offset = Number(topOffset) || 0;
  const chatRect = chatLog.getBoundingClientRect();
  const messageRect = message.getBoundingClientRect();
  const rawTarget = chatLog.scrollTop + (messageRect.top - chatRect.top) - offset;
  const maxTarget = Math.max(0, chatLog.scrollHeight - chatLog.clientHeight);
  return Math.min(maxTarget, Math.max(0, rawTarget));
}

function addMessage(role, text, metaText, options = {}) {
  const message = document.createElement("article");
  message.className = `message ${role}`;
  if (options.messageType === "routing-system") {
    message.classList.add("routing-system-message");
  }

  const textNode = document.createElement("div");
  textNode.className = "content";
  if (role === "assistant" || options.renderMarkdown === true) {
    textNode.innerHTML = renderMarkdown(text);
  } else {
    textNode.textContent = text;
  }
  message.appendChild(textNode);

  if (metaText) {
    const meta = document.createElement("div");
    meta.className = "meta";
    if (options.metaType === "routing") {
      meta.classList.add("routing-meta");
    }
    meta.textContent = metaText;
    message.appendChild(meta);
  }

  chatLog.appendChild(message);
  if (role === "assistant") {
    // Align the beginning of the answer a bit below the top edge.
    const topOffset = 28;
    requestAnimationFrame(() => {
      const targetTop = targetTopForMessage(message, topOffset);
      smoothScrollChatTo(targetTop, 1100, () => {
        // Correct any tiny post-layout drift so the top aligns exactly.
        chatLog.scrollTop = targetTopForMessage(message, topOffset);
      });
    });
    return;
  }
  if (options.disableAutoScroll === true) {
    return;
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

function submitComposerForm() {
  if (typeof composer.requestSubmit === "function") {
    composer.requestSubmit();
    return;
  }
  composer.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

function submitSuggestedQuery(query) {
  const suggestion = String(query || "").trim();
  if (!suggestion) {
    return;
  }
  queryInput.value = suggestion;
  queryInput.focus();
  if (sendButton.disabled) {
    return;
  }
  submitComposerForm();
}

function selectRandomQueries(queries, count) {
  const suggestions = Array.isArray(queries)
    ? queries.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (!suggestions.length) {
    return [];
  }
  const maxCount = Math.max(0, Math.floor(Number(count) || 0));
  const limitedCount = Math.min(maxCount, suggestions.length);
  const shuffled = [...suggestions];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, limitedCount);
}

function addStarterQueryMessage(queries) {
  const suggestions = selectRandomQueries(queries, STARTER_QUERY_DISPLAY_COUNT);
  if (!suggestions.length) {
    return;
  }

  const message = document.createElement("article");
  message.className = "message system";

  const textNode = document.createElement("div");
  textNode.className = "content";

  const intro = document.createElement("p");
  intro.textContent = "Try asking:";
  textNode.appendChild(intro);

  const list = document.createElement("ul");
  for (const suggestion of suggestions) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = suggestion;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      trackEvent("starter_query_clicked", {
        query_length: suggestion.length,
      });
      submitSuggestedQuery(suggestion);
    });
    item.appendChild(link);
    list.appendChild(item);
  }
  textNode.appendChild(list);
  message.appendChild(textNode);

  chatLog.appendChild(message);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function setRoutingMetaVisibility(isVisible) {
  if (!pageBody) {
    return;
  }
  pageBody.classList.toggle(ROUTING_META_HIDDEN_CLASS, !isVisible);
  if (toggleRoutingMeta && toggleRoutingMeta.checked !== isVisible) {
    toggleRoutingMeta.checked = isVisible;
  }
  try {
    window.localStorage.setItem(ROUTING_META_STORAGE_KEY, isVisible ? "1" : "0");
  } catch (error) {
    // Ignore storage failures in private mode or restricted environments.
  }
}

function normalizeThemeName(themeName) {
  if (typeof themeName !== "string") {
    return THEME_DEFAULT;
  }
  const normalized = themeName.trim().toLowerCase();
  if (SUPPORTED_THEMES.has(normalized)) {
    return normalized;
  }
  return THEME_DEFAULT;
}

function setTheme(themeName, options = {}) {
  const selectedTheme = normalizeThemeName(themeName);
  const shouldPersist = options.persist !== false;

  if (rootElement) {
    if (selectedTheme === THEME_DEFAULT) {
      rootElement.removeAttribute("data-theme");
    } else {
      rootElement.setAttribute("data-theme", selectedTheme);
    }
  }

  if (themeSelect && themeSelect.value !== selectedTheme) {
    themeSelect.value = selectedTheme;
  }

  if (shouldPersist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, selectedTheme);
    } catch (error) {
      // Ignore storage failures in private mode or restricted environments.
    }
  }

  return selectedTheme;
}

function setSettingsPanelOpen(isOpen) {
  if (!settingsToggle || !settingsPanel) {
    return;
  }
  const open = Boolean(isOpen);
  settingsPanel.hidden = !open;
  settingsToggle.setAttribute("aria-expanded", String(open));
}

function loadRoutingMetaPreference() {
  let saved = null;
  try {
    saved = window.localStorage.getItem(ROUTING_META_STORAGE_KEY);
  } catch (error) {
    saved = null;
  }
  setRoutingMetaVisibility(saved !== "0");
}

function loadThemePreference() {
  let saved = null;
  try {
    saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch (error) {
    saved = null;
  }
  setTheme(saved, { persist: false });
}

loadThemePreference();
loadRoutingMetaPreference();

if (toggleRoutingMeta) {
  toggleRoutingMeta.addEventListener("change", (event) => {
    setRoutingMetaVisibility(Boolean(event.target.checked));
    trackEvent("routing_meta_toggled", {
      visible: event.target.checked ? 1 : 0,
    });
  });
}

if (themeSelect) {
  themeSelect.addEventListener("change", (event) => {
    const selectedTheme = setTheme(event.target.value);
    trackEvent("theme_toggled", { theme: selectedTheme });
  });
}

if (settingsToggle && settingsPanel) {
  settingsToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setSettingsPanelOpen(settingsPanel.hidden);
  });

  document.addEventListener("click", (event) => {
    if (settingsPanel.hidden) {
      return;
    }
    if (settingsPanel.contains(event.target) || settingsToggle.contains(event.target)) {
      return;
    }
    setSettingsPanelOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || settingsPanel.hidden) {
      return;
    }
    setSettingsPanelOpen(false);
    settingsToggle.focus();
  });
}

function parseLambdaPayload(payload) {
  if (payload && typeof payload === "object" && typeof payload.body === "string") {
    try {
      return JSON.parse(payload.body);
    } catch (err) {
      return payload;
    }
  }
  return payload;
}

function parseJsonResponse(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Non-JSON response: ${text}`);
  }
}

function isHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function buildSourcesMarkdown(sources) {
  if (!Array.isArray(sources) || !sources.length) {
    return "";
  }

  const lines = [];
  const seen = new Set();
  for (const source of sources) {
    if (!source || typeof source !== "object") {
      continue;
    }
    const url = typeof source.url === "string" ? source.url.trim() : "";
    if (!isHttpUrl(url)) {
      continue;
    }

    const title = typeof source.title === "string" ? source.title.trim() : "";
    const safeTitle = (title || url).replace(/\[/g, "(").replace(/\]/g, ")");
    const key = `${safeTitle}::${url}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lines.push(`- [${safeTitle}](${url})`);
  }

  if (!lines.length) {
    return "";
  }
  return `\n\n### Sources\n${lines.join("\n")}`;
}

function tokenizeKeywords(text) {
  const tokens = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 3 && !STOP_WORDS.has(value));
  return Array.from(new Set(tokens));
}

function routeKeywords(route) {
  const parts = [
    route && route.index ? String(route.index) : "",
    route && route.source_file ? String(route.source_file) : "",
    route && route.description ? String(route.description) : "",
    ...(route && Array.isArray(route.sample_queries) ? route.sample_queries.map((value) => String(value)) : []),
  ];
  return tokenizeKeywords(parts.join(" "));
}

function buildStatusSteps(query) {
  const queryKeywords = tokenizeKeywords(query);
  const scoredRoutes = routes
    .map((route) => {
      const keywords = routeKeywords(route);
      const overlap = keywords.filter((keyword) => queryKeywords.includes(keyword)).length;
      return { route, keywords, score: overlap };
    })
    .sort((a, b) => b.score - a.score || a.route.index.localeCompare(b.route.index));

  const highlighted = scoredRoutes.slice(0, Math.min(3, scoredRoutes.length));
  const customRouteSteps = highlighted.flatMap((item) => {
    const label = item.route.index || "index";
    const topicTerms = item.keywords.slice(0, 2);
    const topicText = topicTerms.length ? topicTerms.join(" / ") : "domain signals";
    return [
      `Scanning ${label} for legal authorities on ${topicText}`,
      `Framing focused court-research prompt for ${label}`,
    ];
  });

  const baseSteps = [
    "Reviewing your question for jurisdiction and procedure cues",
    "Identifying parties, filings, deadlines, and legal issues",
    "Drafting candidate routes across court knowledge indices",
    "Ranking the most relevant legal research sequence",
    "Preparing index-specific prompts for statutes and case law",
  ];
  const finalizeSteps = [
    "Executing the selected court research workflow",
    "Collecting supporting rules, cases, and procedures",
    "Cross-checking findings across sources and jurisdictions",
    "Drafting a clear, court-focused response",
    "Running a final legal-consistency review",
  ];

  return [...baseSteps, ...customRouteSteps, ...finalizeSteps];
}

function startStatusCycle(query) {
  stopStatusCycle();
  setProcessingBackground(true);
  setStatusProcessingAnimation(true);
  statusCycleRunId += 1;
  const cycleRunId = statusCycleRunId;
  const steps = buildStatusSteps(query);
  if (!steps.length) {
    statusText.textContent = "Working...";
    return;
  }

  const typingMinDelayMs = 44;
  const typingMaxDelayMs = 76;
  const deletingMinDelayMs = 20;
  const deletingMaxDelayMs = 38;
  const holdAfterTypingMs = 650;
  const holdAfterDeletingMs = 180;

  let stepIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  const easeInOutSine = (progress) => 0.5 - (Math.cos(Math.PI * progress) / 2);

  const easedDelay = (progress, minDelayMs, maxDelayMs) => {
    const clamped = Math.max(0, Math.min(1, progress));
    const eased = easeInOutSine(clamped);
    return Math.round(maxDelayMs - ((maxDelayMs - minDelayMs) * eased));
  };

  const queueNext = (delayMs) => {
    statusCycleTimer = window.setTimeout(() => {
      window.requestAnimationFrame(tick);
    }, delayMs);
  };

  const tick = () => {
    if (cycleRunId !== statusCycleRunId) {
      return;
    }
    const step = steps[stepIndex];

    if (!isDeleting) {
      charIndex = Math.min(step.length, charIndex + 1);
      statusText.textContent = step.slice(0, charIndex);
      if (charIndex < step.length) {
        const typingProgress = step.length ? charIndex / step.length : 1;
        queueNext(easedDelay(typingProgress, typingMinDelayMs, typingMaxDelayMs));
        return;
      }
      isDeleting = true;
      queueNext(holdAfterTypingMs);
      return;
    }

    charIndex = Math.max(0, charIndex - 1);
    statusText.textContent = step.slice(0, charIndex);
    if (charIndex > 0) {
      const deletingProgress = step.length ? (step.length - charIndex) / step.length : 1;
      queueNext(easedDelay(deletingProgress, deletingMinDelayMs, deletingMaxDelayMs));
      return;
    }

    stepIndex = (stepIndex + 1) % steps.length;
    isDeleting = false;
    queueNext(holdAfterDeletingMs);
  };

  statusText.textContent = "";
  tick();
}

function stopStatusCycle(finalText) {
  statusCycleRunId += 1;
  if (statusCycleTimer !== null) {
    window.clearTimeout(statusCycleTimer);
    statusCycleTimer = null;
  }
  setProcessingBackground(false);
  setStatusProcessingAnimation(false);
  if (typeof finalText === "string") {
    statusText.textContent = finalText;
  }
}

async function callOrchestrator(query) {
  if (!orchestratorUrl) {
    throw new Error("Missing orchestrator function URL. Run launch to update app-config.js.");
  }

  const response = await fetch(orchestratorUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const text = await response.text();
  const payload = parseJsonResponse(text);
  const normalized = parseLambdaPayload(payload);

  if (!response.ok) {
    throw new Error(normalized.error || normalized.Message || `Request failed (${response.status}).`);
  }
  if (!normalized || typeof normalized !== "object") {
    throw new Error("Unexpected orchestrator response payload.");
  }
  return normalized;
}

// Enter sends the request; Shift+Enter inserts a newline.
queryInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  if (sendButton.disabled) {
    return;
  }
  submitComposerForm();
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = queryInput.value.trim();
  if (!query) {
    statusText.textContent = "Type a query first.";
    return;
  }

  trackEvent("query_submitted", {
    query_length: query.length,
    route_count: routes.length,
    has_orchestrator: orchestratorUrl ? 1 : 0,
  });

  sendButton.disabled = true;
  queryInput.disabled = true;
  startStatusCycle(query);
  addMessage("user", query);
  queryInput.value = "";

  try {
    const result = await callOrchestrator(query);
    const route = result.route && typeof result.route === "object" ? result.route : {};

    const routedIndices = Array.isArray(route.indices)
      ? route.indices.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const selectedIndex = routedIndices[0] || String(route.index || "").trim();

    if (selectedIndex || route.reason || routedIndices.length) {
      const routeLabel = routedIndices.length > 1
        ? `Auto-selected sequence: ${routedIndices.join(" -> ")}`
        : selectedIndex
          ? `Auto-selected index '${selectedIndex}'.`
          : "Routing completed.";
      const routeMeta = String(route.reason || "").trim() || undefined;
      addMessage("system", routeLabel, routeMeta, { metaType: "routing", messageType: "routing-system" });
      trackEvent("route_selected", {
        selected_index: selectedIndex || "none",
        routed_count: routedIndices.length || (selectedIndex ? 1 : 0),
      });
    }

    const answer = String(result.answer || "").trim() || "(no answer field returned)";
    const sources = Array.isArray(result.sources) ? result.sources : [];
    const sourcesMarkdown = buildSourcesMarkdown(sources);

    let meta = "";
    if (routedIndices.length > 1) {
      meta = routedIndices.join(" -> ");
    } else if (selectedIndex) {
      meta = selectedIndex;
    }

    addMessage("assistant", answer, meta, { metaType: "routing" });
    if (sourcesMarkdown) {
      addMessage("system", sourcesMarkdown.trim(), undefined, {
        renderMarkdown: true,
        disableAutoScroll: true,
      });
    }
    trackEvent("query_succeeded", {
      selected_index: selectedIndex || "none",
      routed_count: routedIndices.length || (selectedIndex ? 1 : 0),
      source_count: sources.length,
      answer_length: answer.length,
    });
    stopStatusCycle("Done.");
  } catch (error) {
    addMessage("system", String(error.message || error), "orchestrator");
    trackEvent("query_failed", {
      error_type: classifyErrorType(error),
    });
    stopStatusCycle("Error.");
  } finally {
    sendButton.disabled = false;
    queryInput.disabled = false;
  }
});

addMessage(
  "system",
  routes.length
    ? orchestratorUrl
      ? "Get instant guidance on California court procedures, forms, and legal processes. CalQuery automatically routes your question to trusted court information and self-help resources."
      : "Missing orchestrator URL in app-config.js. Re-run launch."
    : "No hardcoded routes found. Run launch to generate app-config.js."
);

window.setTimeout(() => {
  addStarterQueryMessage(STARTER_QUERIES);
}, STARTER_QUERY_MESSAGE_DELAY_MS);

trackEvent("app_loaded", {
  route_count: routes.length,
  has_orchestrator: orchestratorUrl ? 1 : 0,
});
