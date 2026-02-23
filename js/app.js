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
const pendingAnalyticsEvents = [];
let nextSubmitTrigger = "send_button";

const composer = document.getElementById("composer");
const queryInput = document.getElementById("queryInput");
const sendButton = document.getElementById("sendButton");
const chatLog = document.getElementById("chatLog");
const footerYear = document.getElementById("footerYear");
const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel = document.getElementById("settingsPanel");
const toggleRoutingMeta = document.getElementById("toggleRoutingMeta");
const themeSelect = document.getElementById("themeSelect");
const siteSelect = document.getElementById("siteSelect");
const personaSelect = document.getElementById("personaSelect");
const clearCacheButton = document.getElementById("clearCacheButton");
const brandLogo = document.querySelector(".brand-logo");
const brandText = document.querySelector(".brand-text");
const brandTitle = document.querySelector(".brand-text h1");
const rootElement = document.documentElement;
const pageBody = document.body;
const infoAccordionItems = Array.from(document.querySelectorAll(".info-accordion-item"));
let chatScrollRafId = null;
let brandLogoSyncRafId = null;
let userHasSubmittedQuery = false;
let starterMessageTimeoutId = null;
let starterFollowupTimeoutId = null;
let starterQueryTimeoutId = null;
const ROUTING_META_HIDDEN_CLASS = "hide-routing-meta";
const ROUTING_META_STORAGE_KEY = "calquery-routing-meta-visible";
const THEME_STORAGE_KEY = "calquery-theme";
const SITE_FILTER_STORAGE_KEY = "calquery-site-filter";
const PERSONA_STORAGE_KEY = "calquery-persona";
const THEME_DEFAULT = "default";
const THEME_KANAGAWA = "kanagawa";
const THEME_GRUVBOX_DARK = "gruvbox-dark";
const THEME_COURTYARD = "courtyard";
const THEME_GRAYSCALE = "grayscale";
const PERSONA_DEFAULT = "default";
const PERSONA_SAUL_GOODMAN = "saul-goodman";
const PERSONA_JUDGE_JUDY = "judge-judy";
const PERSONA_ALLY_MCBEAL = "ally-mcbeal";
const PERSONA_VINCENT_GAMBINI = "vincent-gambini";
const PERSONA_JEFF_WINGER = "jeff-winger";
const SITE_FILTER_ALL = "__all__";
const SITE_FILTER_DEFAULT = "self-help";
const BRAND_TITLE_BASE = "CalQuery";
const BRAND_TITLE_SEPARATOR = "→";
const BRAND_LOGO_DEFAULT_SRC = "./images/bear-logo-soft-192.webp?v=2";
const BRAND_LOGO_LIGHT_SRC = "./images/bear-logo-light-192.webp?v=2";
const THEME_STYLESHEET_ID = "themeStylesheet";
const THEME_STYLESHEET_HREFS = {
  [THEME_KANAGAWA]: "./css/kanagawa-theme.css",
  [THEME_GRUVBOX_DARK]: "./css/gruvbox-dark-theme.css",
  [THEME_COURTYARD]: "./css/courtyard-theme.css",
  [THEME_GRAYSCALE]: "./css/grayscale-theme.css",
};
const THEME_FONT_STYLESHEET_ID = "themeFontStylesheet";
const SUPPLEMENTAL_THEME_FONT_STYLESHEET_HREF =
  "https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@700;800&family=Lato:wght@400;700;900&family=Lora:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&family=Noto+Serif+JP:wght@500;700&family=Source+Sans+3:wght@400;600;700&display=swap";
const THEMES_WITH_LIGHT_LOGO = new Set([
  THEME_GRUVBOX_DARK,
  THEME_COURTYARD,
  THEME_GRAYSCALE,
]);
const THEMES_WITH_SUPPLEMENTAL_FONTS = new Set([
  THEME_COURTYARD,
  THEME_GRAYSCALE,
]);
const SUPPORTED_THEMES = new Set([
  THEME_DEFAULT,
  THEME_KANAGAWA,
  THEME_GRUVBOX_DARK,
  THEME_COURTYARD,
  THEME_GRAYSCALE,
]);
const SUPPORTED_PERSONAS = new Set([
  PERSONA_DEFAULT,
  PERSONA_SAUL_GOODMAN,
  PERSONA_JUDGE_JUDY,
  PERSONA_ALLY_MCBEAL,
  PERSONA_VINCENT_GAMBINI,
  PERSONA_JEFF_WINGER,
]);
const PERSONA_ANSWER_PREFIX = {
  [PERSONA_SAUL_GOODMAN]: "All right, here is the case, straight from the record:",
  [PERSONA_JUDGE_JUDY]: "Here is the answer, plain and simple:",
  [PERSONA_ALLY_MCBEAL]: "Here is what the record supports:",
  [PERSONA_VINCENT_GAMBINI]: "Here is what we can prove from the record:",
  [PERSONA_JEFF_WINGER]: "Here is the strongest answer the record supports:",
};
const AVAILABLE_SITE_FILTERS = extractSiteFilters(routes);
const RESPONSE_CACHE_STORAGE_KEY = "calquery-response-cache";
const RESPONSE_CACHE_MAX_ENTRIES = 50;
const STARTER_QUERY_MESSAGE_DELAY_MS = 2000;
const STARTER_MESSAGE_DELAY_MS = 500;
const STARTER_FOLLOWUP_MESSAGE_DELAY_MS = 1000;
const STARTER_QUERY_DISPLAY_COUNT = 3;
const INSUFFICIENT_INFORMATION_PHRASES = [
  "do not have enough information",
  "do not have sufficient information",
  "not have enough information",
  "insufficient information",
  "cannot provide an answer",
  "unable to provide an answer",
  "unable to answer",
  "does not contain information",
  "does not contain enough information",
  "does not contain specific information",
  "does not provide information",
  "did not yield any relevant",
  "no relevant information",
  "no relevant results",
  "cannot answer your",
  "cannot answer this",
  "outside the scope of the provided",
  "beyond the scope of the provided",
  "lack the information",
  "missing the information",
  "do not have the details",
  "do not have the specifics"
];
const ACCORDION_ANIMATION_DURATION_MS = 220;
const ACCORDION_ANIMATION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const INFO_ACCORDION_MOBILE_BREAKPOINT_PX = 980;
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
  "What deadlines apply after filing an appeal and what steps come next?",
  "What is the difference between mediation, arbitration, and going to trial?",
  "How do I challenge evidence or object during a court proceeding?",
  "What forms do I need for name change?"
];

if (footerYear) {
  footerYear.textContent = String(new Date().getFullYear());
}

function syncBrandLogoHeight() {
  if (!brandLogo || !brandText) {
    return;
  }
  const measuredHeight = brandText.getBoundingClientRect().height;
  const targetHeight = Math.max(1, Math.round(measuredHeight));
  brandLogo.style.height = `${targetHeight}px`;
}

function requestBrandLogoHeightSync() {
  if (!brandLogo || !brandText) {
    return;
  }
  if (brandLogoSyncRafId !== null) {
    window.cancelAnimationFrame(brandLogoSyncRafId);
  }
  brandLogoSyncRafId = window.requestAnimationFrame(() => {
    brandLogoSyncRafId = null;
    syncBrandLogoHeight();
  });
}

if (brandLogo && brandText) {
  requestBrandLogoHeightSync();
  window.addEventListener("resize", requestBrandLogoHeightSync);
  brandLogo.addEventListener("load", requestBrandLogoHeightSync);
  if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
    document.fonts.ready.then(() => {
      requestBrandLogoHeightSync();
    });
  }
}

function extractSiteFilters(routeItems) {
  const uniqueByKey = new Map();
  if (!Array.isArray(routeItems)) {
    return [];
  }

  for (const routeItem of routeItems) {
    if (!routeItem || typeof routeItem !== "object") {
      continue;
    }
    const routeSites = Array.isArray(routeItem.sites) ? routeItem.sites : [];
    for (const rawSite of routeSites) {
      const siteName = String(rawSite || "").trim();
      if (!siteName) {
        continue;
      }
      const siteKey = siteName.toLowerCase();
      if (!uniqueByKey.has(siteKey)) {
        uniqueByKey.set(siteKey, siteName);
      }
    }
  }

  return Array.from(uniqueByKey.values()).sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

function normalizeSiteFilterValue(siteValue) {
  const normalized = String(siteValue || "").trim();
  if (!normalized || normalized === SITE_FILTER_ALL) {
    return SITE_FILTER_ALL;
  }
  const normalizedKey = normalized.toLowerCase();
  for (const availableSite of AVAILABLE_SITE_FILTERS) {
    if (availableSite.toLowerCase() === normalizedKey) {
      return availableSite;
    }
  }
  return SITE_FILTER_ALL;
}

function normalizeSiteKey(siteValue) {
  return String(siteValue || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function updateBrandTitle(siteFilterValue) {
  const siteLabel = siteFilterValue === SITE_FILTER_ALL ? "All Sites" : String(siteFilterValue || "").trim();
  const formattedSiteLabel = siteLabel || "All Sites";
  if (!brandTitle) {
    return;
  }
  const titlePrefix = document.createElement("span");
  titlePrefix.className = "brand-title-main";
  titlePrefix.textContent = BRAND_TITLE_BASE;

  const titleSeparator = document.createElement("span");
  titleSeparator.className = "brand-title-separator";
  titleSeparator.textContent = BRAND_TITLE_SEPARATOR;
  titleSeparator.setAttribute("aria-hidden", "true");

  const titleSite = document.createElement("span");
  titleSite.className = "brand-title-site";
  titleSite.textContent = formattedSiteLabel;

  brandTitle.replaceChildren(titlePrefix, titleSeparator, titleSite);
}

function getDefaultSiteFilterValue() {
  const targetKey = normalizeSiteKey(SITE_FILTER_DEFAULT);
  for (const availableSite of AVAILABLE_SITE_FILTERS) {
    if (normalizeSiteKey(availableSite) === targetKey) {
      return availableSite;
    }
  }
  return SITE_FILTER_ALL;
}

function setSiteFilter(siteValue, options = {}) {
  const selectedSiteFilter = normalizeSiteFilterValue(siteValue);
  const shouldPersist = options.persist !== false;

  if (siteSelect && siteSelect.value !== selectedSiteFilter) {
    siteSelect.value = selectedSiteFilter;
  }

  updateBrandTitle(selectedSiteFilter);

  if (shouldPersist) {
    try {
      window.localStorage.setItem(SITE_FILTER_STORAGE_KEY, selectedSiteFilter);
    } catch (error) {
      // Ignore storage failures in private mode or restricted environments.
    }
  }

  return selectedSiteFilter;
}

function populateSiteFilterOptions() {
  if (!siteSelect) {
    return;
  }

  const previousSelection = normalizeSiteFilterValue(siteSelect.value);
  siteSelect.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = SITE_FILTER_ALL;
  allOption.textContent = "All Sites";
  siteSelect.appendChild(allOption);

  for (const siteName of AVAILABLE_SITE_FILTERS) {
    const option = document.createElement("option");
    option.value = siteName;
    option.textContent = siteName;
    siteSelect.appendChild(option);
  }

  siteSelect.value = previousSelection;
}

function loadSiteFilterPreference() {
  let saved = null;
  try {
    saved = window.localStorage.getItem(SITE_FILTER_STORAGE_KEY);
  } catch (error) {
    saved = null;
  }
  const savedRaw = String(saved || "").trim();
  if (savedRaw) {
    setSiteFilter(savedRaw, { persist: false });
    return;
  }
  setSiteFilter(getDefaultSiteFilterValue(), { persist: false });
}

function readSiteFilterFromQueryString() {
  if (typeof window === "undefined" || !window.location) {
    return null;
  }

  const searchText = String(window.location.search || "");
  if (!searchText) {
    return null;
  }

  try {
    const params = new URLSearchParams(searchText);
    const rawSite = String(params.get("site") || "").trim();
    if (!rawSite) {
      return null;
    }

    if (rawSite === SITE_FILTER_ALL || rawSite.toLowerCase() === "all") {
      return SITE_FILTER_ALL;
    }

    const explicitSite = normalizeSiteFilterValue(rawSite);
    if (explicitSite !== SITE_FILTER_ALL) {
      return explicitSite;
    }

    const normalizedKey = normalizeSiteKey(rawSite);
    if (!normalizedKey) {
      return null;
    }

    for (const availableSite of AVAILABLE_SITE_FILTERS) {
      if (normalizeSiteKey(availableSite) === normalizedKey) {
        return availableSite;
      }
    }
  } catch (error) {
    return null;
  }

  return null;
}

function syncSiteFilterQueryString(siteValue) {
  if (typeof window === "undefined" || !window.location || !window.history) {
    return;
  }

  const selectedSite = normalizeSiteFilterValue(siteValue);
  const nextUrl = new URL(window.location.href);

  if (selectedSite === SITE_FILTER_ALL) {
    nextUrl.searchParams.delete("site");
  } else {
    nextUrl.searchParams.set("site", selectedSite);
  }

  const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextPath !== currentPath) {
    window.history.replaceState({}, "", nextPath);
  }
}

function getSelectedSiteFilter() {
  return normalizeSiteFilterValue(siteSelect ? siteSelect.value : SITE_FILTER_ALL);
}

function normalizePersonaName(personaName) {
  const normalized = String(personaName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) {
    return PERSONA_DEFAULT;
  }
  if (SUPPORTED_PERSONAS.has(normalized)) {
    return normalized;
  }
  return PERSONA_DEFAULT;
}

function setPersona(personaName, options = {}) {
  const selectedPersona = normalizePersonaName(personaName);
  const shouldPersist = options.persist !== false;

  if (personaSelect && personaSelect.value !== selectedPersona) {
    personaSelect.value = selectedPersona;
  }

  if (shouldPersist) {
    try {
      window.localStorage.setItem(PERSONA_STORAGE_KEY, selectedPersona);
    } catch (error) {
      // Ignore storage failures in private mode or restricted environments.
    }
  }

  return selectedPersona;
}

function loadPersonaPreference() {
  let saved = null;
  try {
    saved = window.localStorage.getItem(PERSONA_STORAGE_KEY);
  } catch (error) {
    saved = null;
  }
  setPersona(saved, { persist: false });
}

function getSelectedPersona() {
  return normalizePersonaName(personaSelect ? personaSelect.value : PERSONA_DEFAULT);
}

function applyPersonaAnswerVoice(answerText, personaName) {
  const normalizedAnswer = String(answerText || "").trim();
  if (!normalizedAnswer) {
    return normalizedAnswer;
  }
  const selectedPersona = normalizePersonaName(personaName);
  if (selectedPersona === PERSONA_DEFAULT) {
    return normalizedAnswer;
  }
  const personaPrefix = PERSONA_ANSWER_PREFIX[selectedPersona];
  if (!personaPrefix) {
    return normalizedAnswer;
  }
  if (normalizedAnswer.startsWith(personaPrefix)) {
    return normalizedAnswer;
  }
  return `${personaPrefix}\n\n${normalizedAnswer}`;
}

function toAnalyticsSiteFilter(siteValue) {
  const normalizedSite = normalizeSiteFilterValue(siteValue);
  return normalizedSite === SITE_FILTER_ALL ? "all" : normalizedSite;
}

function toAnalyticsDurationMs(startTime) {
  if (typeof startTime !== "number" || !Number.isFinite(startTime)) {
    return 0;
  }
  return Math.max(0, Math.round(performance.now() - startTime));
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
  flushPendingAnalyticsEvents();
}

function flushPendingAnalyticsEvents() {
  if (!analyticsEnabled || typeof window.gtag !== "function" || !pendingAnalyticsEvents.length) {
    return;
  }

  while (pendingAnalyticsEvents.length) {
    const nextEvent = pendingAnalyticsEvents.shift();
    if (!nextEvent || !nextEvent.name) {
      continue;
    }
    window.gtag("event", nextEvent.name, nextEvent.params);
  }
}

function scheduleAnalyticsInitialization() {
  if (!googleTagId) {
    return;
  }

  const runWhenIdle = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => {
        initializeAnalytics();
      }, { timeout: 2500 });
      return;
    }
    window.setTimeout(() => {
      initializeAnalytics();
    }, 1200);
  };

  if (document.readyState === "complete") {
    runWhenIdle();
    return;
  }

  window.addEventListener("load", runWhenIdle, { once: true });
}

function trackEvent(name, params = {}) {
  if (!googleTagId || !name) {
    return;
  }
  if (!analyticsEnabled || typeof window.gtag !== "function") {
    if (pendingAnalyticsEvents.length >= 40) {
      pendingAnalyticsEvents.shift();
    }
    pendingAnalyticsEvents.push({ name, params });
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

scheduleAnalyticsInitialization();

function setProcessingBackground(isActive) {
  if (!pageBody) {
    return;
  }
  pageBody.classList.toggle("is-processing", Boolean(isActive));
}

function setSendButtonLoading(isLoading) {
  if (!sendButton) {
    return;
  }
  if (isLoading) {
    sendButton.setAttribute("data-loading", "true");
    sendButton.setAttribute("aria-busy", "true");
    return;
  }
  sendButton.removeAttribute("data-loading");
  sendButton.setAttribute("aria-busy", "false");
}

setSendButtonLoading(false);

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
    .replace(
      /(<a [^>]+>[^<]+<\/a>)\s+\(((?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?::\d{1,5})?)\)/gi,
      '$1 <span class="source-domain">($2)</span>'
    )
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

function alignAssistantMessage(message) {
  // Align the beginning of the answer a bit below the top edge.
  const topOffset = 28;
  requestAnimationFrame(() => {
    const targetTop = targetTopForMessage(message, topOffset);
    smoothScrollChatTo(targetTop, 1100, () => {
      // Correct any tiny post-layout drift so the top aligns exactly.
      chatLog.scrollTop = targetTopForMessage(message, topOffset);
    });
  });
}

function createMessageElements(role, metaText, options = {}) {
  const message = document.createElement("article");
  message.className = `message ${role}`;
  if (options.messageType === "routing-system") {
    message.classList.add("routing-system-message");
  }

  const textNode = document.createElement("div");
  textNode.className = "content";
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

  return { message, textNode };
}

function addMessage(role, text, metaText, options = {}) {
  const { message, textNode } = createMessageElements(role, metaText, options);
  if (role === "assistant" || options.renderMarkdown === true) {
    textNode.innerHTML = renderMarkdown(text);
  } else {
    textNode.textContent = text;
  }

  chatLog.appendChild(message);
  if (role === "assistant") {
    alignAssistantMessage(message);
    return;
  }
  if (options.disableAutoScroll === true) {
    return;
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}


function trackChatOutboundLinkClick(event) {
  if (!(event.target instanceof Element)) {
    return;
  }
  const link = event.target.closest("a");
  if (!link || !chatLog.contains(link)) {
    return;
  }
  if (link.getAttribute("target") !== "_blank") {
    return;
  }
  const href = String(link.getAttribute("href") || "").trim();
  if (!href) {
    return;
  }
  trackEvent("source_link_clicked", {
    source_domain: getDisplayDomain(href) || "unknown",
    link_text_length: String(link.textContent || "").trim().length,
  });
}

if (chatLog) {
  chatLog.addEventListener("click", trackChatOutboundLinkClick);
}

function createLiveAssistantStream(metaText, options = {}) {
  const { message, textNode } = createMessageElements("assistant", "", options);
  chatLog.appendChild(message);

  let answerText = "";
  let finalized = false;
  let metaNode = null;

  function ensureMetaNode() {
    if (metaNode) {
      return metaNode;
    }
    metaNode = document.createElement("div");
    metaNode.className = "meta";
    if (options.metaType === "routing") {
      metaNode.classList.add("routing-meta");
    }
    message.appendChild(metaNode);
    return metaNode;
  }

  function setMeta(nextMetaText) {
    const normalized = String(nextMetaText || "").trim();
    if (!normalized) {
      if (metaNode) {
        metaNode.remove();
        metaNode = null;
      }
      return;
    }
    ensureMetaNode().textContent = normalized;
  }

  function renderTypingDots() {
    if (finalized || answerText) {
      return;
    }
    textNode.innerHTML = "";
    const dots = document.createElement("span");
    dots.className = "typing-dots";
    dots.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 3; index += 1) {
      const dot = document.createElement("span");
      dot.className = "typing-dot";
      dots.appendChild(dot);
    }
    textNode.appendChild(dots);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  setMeta(metaText);
  renderTypingDots();

  return {
    append(deltaText) {
      if (finalized) {
        return;
      }
      const nextChunk = String(deltaText || "");
      if (!nextChunk) {
        return;
      }
      answerText += nextChunk;
      textNode.innerHTML = renderMarkdown(answerText);
      chatLog.scrollTop = chatLog.scrollHeight;
    },
    finalize(finalAnswer) {
      if (typeof finalAnswer === "string" && finalAnswer.length) {
        answerText = finalAnswer;
      }
      textNode.innerHTML = renderMarkdown(answerText);
      finalized = true;
      alignAssistantMessage(message);
      return answerText;
    },
    setMeta,
    getText() {
      return answerText;
    },
    remove() {
      message.remove();
      finalized = true;
    },
  };
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
      nextSubmitTrigger = "starter_query";
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
  trackEvent("starter_queries_displayed", {
    query_count: suggestions.length,
  });
}

function cancelPendingStarterMessages() {
  if (starterMessageTimeoutId !== null) {
    window.clearTimeout(starterMessageTimeoutId);
    starterMessageTimeoutId = null;
  }
  if (starterFollowupTimeoutId !== null) {
    window.clearTimeout(starterFollowupTimeoutId);
    starterFollowupTimeoutId = null;
  }
  if (starterQueryTimeoutId !== null) {
    window.clearTimeout(starterQueryTimeoutId);
    starterQueryTimeoutId = null;
  }
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

function ensureThemeStylesheet(themeName) {
  const selectedTheme = normalizeThemeName(themeName);
  const selectedHref =
    selectedTheme === THEME_DEFAULT ? "" : (THEME_STYLESHEET_HREFS[selectedTheme] || "");
  const existingLink = document.getElementById(THEME_STYLESHEET_ID);

  if (!selectedHref) {
    if (existingLink) {
      existingLink.remove();
    }
    return;
  }

  if (existingLink && existingLink.getAttribute("href") === selectedHref) {
    return;
  }

  const link = existingLink || document.createElement("link");
  link.id = THEME_STYLESHEET_ID;
  link.rel = "stylesheet";
  link.href = selectedHref;
  if (!existingLink) {
    document.head.appendChild(link);
  }
}

function ensureThemeFonts(themeName) {
  const selectedTheme = normalizeThemeName(themeName);
  const shouldLoadSupplementalFonts = THEMES_WITH_SUPPLEMENTAL_FONTS.has(selectedTheme);
  const existingLink = document.getElementById(THEME_FONT_STYLESHEET_ID);

  if (!shouldLoadSupplementalFonts) {
    if (existingLink) {
      existingLink.remove();
    }
    return;
  }

  if (existingLink && existingLink.getAttribute("href") === SUPPLEMENTAL_THEME_FONT_STYLESHEET_HREF) {
    return;
  }

  const link = existingLink || document.createElement("link");
  link.id = THEME_FONT_STYLESHEET_ID;
  link.rel = "stylesheet";
  link.href = SUPPLEMENTAL_THEME_FONT_STYLESHEET_HREF;
  if (!existingLink) {
    document.head.appendChild(link);
  }
}

function setTheme(themeName, options = {}) {
  const selectedTheme = normalizeThemeName(themeName);
  const shouldPersist = options.persist !== false;
  ensureThemeStylesheet(selectedTheme);
  ensureThemeFonts(selectedTheme);

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

  if (brandLogo) {
    const nextLogoSrc = THEMES_WITH_LIGHT_LOGO.has(selectedTheme)
      ? BRAND_LOGO_LIGHT_SRC
      : BRAND_LOGO_DEFAULT_SRC;
    if (brandLogo.getAttribute("src") !== nextLogoSrc) {
      brandLogo.setAttribute("src", nextLogoSrc);
    }
  }
  requestBrandLogoHeightSync();

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
  setRoutingMetaVisibility(saved === "1");
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
loadPersonaPreference();
populateSiteFilterOptions();
loadSiteFilterPreference();
const queryStringSiteFilter = readSiteFilterFromQueryString();
if (queryStringSiteFilter !== null) {
  setSiteFilter(queryStringSiteFilter, { persist: false });
}

if (infoAccordionItems.length) {
  const accordionAnimations = new WeakMap();

  function shouldReduceMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function stopAccordionAnimation(item) {
    const activeAnimation = accordionAnimations.get(item);
    if (!activeAnimation) {
      return;
    }
    activeAnimation.cancel();
    accordionAnimations.delete(item);
  }

  function setAccordionState(item, open) {
    stopAccordionAnimation(item);
    item.open = Boolean(open);
    item.style.height = "";
    item.style.overflow = "";
  }

  const isMobileInfoAccordionViewport =
    typeof window.matchMedia === "function" &&
    window.matchMedia(`(max-width: ${INFO_ACCORDION_MOBILE_BREAKPOINT_PX}px)`).matches;
  if (isMobileInfoAccordionViewport) {
    for (const accordionItem of infoAccordionItems) {
      setAccordionState(accordionItem, false);
    }
  }

  function animateAccordionState(item, open) {
    const summary = item.querySelector(".info-accordion-summary");
    const content = item.querySelector(".info-accordion-content");
    if (!summary || !content) {
      setAccordionState(item, open);
      return;
    }

    if (shouldReduceMotion() || typeof item.animate !== "function") {
      setAccordionState(item, open);
      return;
    }

    stopAccordionAnimation(item);

    const startHeight = item.offsetHeight || summary.offsetHeight;
    let endHeight = summary.offsetHeight;

    if (open) {
      item.open = true;
      endHeight = summary.offsetHeight + content.offsetHeight;
    }

    item.style.height = `${startHeight}px`;
    item.style.overflow = "hidden";

    const animation = item.animate(
      { height: [`${startHeight}px`, `${endHeight}px`] },
      {
        duration: ACCORDION_ANIMATION_DURATION_MS,
        easing: ACCORDION_ANIMATION_EASING,
      }
    );

    accordionAnimations.set(item, animation);

    animation.onfinish = () => {
      item.open = Boolean(open);
      item.style.height = "";
      item.style.overflow = "";
      accordionAnimations.delete(item);
    };

    animation.oncancel = () => {
      item.style.height = "";
      item.style.overflow = "";
      accordionAnimations.delete(item);
    };
  }

  for (const accordionItem of infoAccordionItems) {
    const summary = accordionItem.querySelector(".info-accordion-summary");
    if (!summary) {
      continue;
    }

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      const isOpening = !accordionItem.open;

      if (isOpening) {
        for (const otherItem of infoAccordionItems) {
          if (otherItem !== accordionItem && otherItem.open) {
            animateAccordionState(otherItem, false);
          }
        }
      }

      animateAccordionState(accordionItem, isOpening);
    });
  }
}

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

if (personaSelect) {
  personaSelect.addEventListener("change", (event) => {
    const selectedPersona = setPersona(event.target.value);
    trackEvent("persona_toggled", { persona: selectedPersona });
  });
}

if (siteSelect) {
  siteSelect.addEventListener("change", (event) => {
    const selectedSite = setSiteFilter(event.target.value);
    syncSiteFilterQueryString(selectedSite);
    trackEvent("site_filter_toggled", {
      site: toAnalyticsSiteFilter(selectedSite),
    });
  });
}

if (clearCacheButton) {
  const clearCacheLabel = clearCacheButton.querySelector(".clear-cache-label");
  clearCacheButton.addEventListener("click", () => {
    const entryCount = Object.keys(loadResponseCache()).length;
    clearResponseCache();
    if (clearCacheLabel) {
      clearCacheLabel.textContent = "Cleared";
      setTimeout(() => {
        clearCacheLabel.textContent = "Clear cache";
      }, 1500);
    }
    trackEvent("cache_cleared", {
      entry_count: entryCount,
    });
  });
}

if (settingsToggle && settingsPanel) {
  settingsToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextOpenState = settingsPanel.hidden;
    setSettingsPanelOpen(nextOpenState);
    trackEvent("settings_panel_toggled", {
      open: nextOpenState ? 1 : 0,
      trigger: "toggle_button",
    });
  });

  document.addEventListener("click", (event) => {
    if (settingsPanel.hidden) {
      return;
    }
    if (settingsPanel.contains(event.target) || settingsToggle.contains(event.target)) {
      return;
    }
    setSettingsPanelOpen(false);
    trackEvent("settings_panel_toggled", {
      open: 0,
      trigger: "outside_click",
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || settingsPanel.hidden) {
      return;
    }
    setSettingsPanelOpen(false);
    trackEvent("settings_panel_toggled", {
      open: 0,
      trigger: "escape_key",
    });
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

function tryParseJsonResponse(text) {
  try {
    return parseJsonResponse(text);
  } catch (_error) {
    return {};
  }
}

function parseSseBlock(blockText) {
  const lines = String(blockText || "").split("\n");
  let eventType = "message";
  const dataLines = [];

  for (const rawLine of lines) {
    const line = String(rawLine || "");
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      eventType = line.slice("event:".length).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  return {
    eventType,
    data: dataLines.join("\n"),
  };
}

function parseSseData(dataText) {
  const raw = String(dataText || "").trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return { text: raw };
  }
}

async function consumeOrchestratorEventStream(stream, handlers = {}) {
  if (!stream || typeof stream.getReader !== "function") {
    return {};
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

    let boundaryIndex = buffer.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const block = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);
      boundaryIndex = buffer.indexOf("\n\n");

      if (!block.trim()) {
        continue;
      }
      const parsedEvent = parseSseBlock(block);
      const payload = parseSseData(parsedEvent.data);

      if (parsedEvent.eventType === "route") {
        if (typeof handlers.onRoute === "function") {
          handlers.onRoute(payload);
        }
        continue;
      }
      if (parsedEvent.eventType === "delta") {
        const deltaText = String(
          payload.text || payload.delta || payload.content || payload.chunk || ""
        );
        if (deltaText && typeof handlers.onDelta === "function") {
          handlers.onDelta(deltaText);
        }
        continue;
      }
      if (parsedEvent.eventType === "done") {
        donePayload = payload;
        if (typeof handlers.onDone === "function") {
          handlers.onDone(payload);
        }
        continue;
      }
      if (parsedEvent.eventType === "error") {
        const errorMessage = String(payload.error || payload.message || "Streaming request failed.");
        if (typeof handlers.onError === "function") {
          handlers.onError(errorMessage, payload);
        }
        throw new Error(errorMessage);
      }
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    const parsedEvent = parseSseBlock(trailing);
    const payload = parseSseData(parsedEvent.data);
    if (parsedEvent.eventType === "done") {
      donePayload = payload;
      if (typeof handlers.onDone === "function") {
        handlers.onDone(payload);
      }
    } else if (parsedEvent.eventType === "delta") {
      const deltaText = String(payload.text || payload.delta || payload.content || payload.chunk || "");
      if (deltaText && typeof handlers.onDelta === "function") {
        handlers.onDelta(deltaText);
      }
    } else if (parsedEvent.eventType === "error") {
      const errorMessage = String(payload.error || payload.message || "Streaming request failed.");
      if (typeof handlers.onError === "function") {
        handlers.onError(errorMessage, payload);
      }
      throw new Error(errorMessage);
    }
  }

  return donePayload || {};
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

function getDisplayDomain(url) {
  try {
    const parsed = new URL(String(url || "").trim(), window.location.href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    const hostname = parsed.hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch (error) {
    return "";
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
    const domain = getDisplayDomain(url);
    const key = `${safeTitle}::${url}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lines.push(domain ? `- [${safeTitle}](${url}) (${domain})` : `- [${safeTitle}](${url})`);
  }

  if (!lines.length) {
    return "";
  }
  return `\n\n### Sources\n${lines.join("\n")}`;
}

function isInsufficientInformationAnswer(answer) {
  const normalized = String(answer || "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[`*_#>~[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return INSUFFICIENT_INFORMATION_PHRASES.some((phrase) => normalized.includes(phrase));
}

function getRequestSiteFilter(siteFilterValue) {
  const selectedSite = normalizeSiteFilterValue(siteFilterValue);
  if (selectedSite === SITE_FILTER_ALL) {
    return "";
  }
  return selectedSite;
}

function describeRoute(route) {
  const normalizedRoute = route && typeof route === "object" ? route : {};
  const routedIndices = Array.isArray(normalizedRoute.indices)
    ? normalizedRoute.indices.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const selectedIndex = routedIndices[0] || String(normalizedRoute.index || "").trim();

  let answerMeta = "";
  if (routedIndices.length > 1) {
    answerMeta = routedIndices.join(" -> ");
  } else if (selectedIndex) {
    answerMeta = selectedIndex;
  }

  const routeLabel = routedIndices.length > 1
    ? `Auto-selected sequence: ${routedIndices.join(" -> ")}`
    : selectedIndex
      ? `Auto-selected index '${selectedIndex}'.`
      : "Routing completed.";

  return {
    route: normalizedRoute,
    selectedIndex,
    routedIndices,
    answerMeta,
    routeLabel,
    routeMeta: String(normalizedRoute.reason || "").trim() || undefined,
  };
}

function renderRouteMessage(routeDetails, selectedSiteFilter) {
  if (!routeDetails || typeof routeDetails !== "object") {
    return;
  }
  if (!routeDetails.selectedIndex && !routeDetails.routeMeta && !routeDetails.routedIndices.length) {
    return;
  }

  addMessage("system", routeDetails.routeLabel, routeDetails.routeMeta, {
    metaType: "routing",
    messageType: "routing-system",
  });
  trackEvent("route_selected", {
    selected_index: routeDetails.selectedIndex || "none",
    routed_count: routeDetails.routedIndices.length || (routeDetails.selectedIndex ? 1 : 0),
    site_filter: toAnalyticsSiteFilter(selectedSiteFilter),
  });
}

function buildResponseCacheKey(query, site, persona) {
  const q = String(query || "").trim().toLowerCase();
  const s = String(site || "").trim().toLowerCase();
  const p = String(persona || "").trim().toLowerCase();
  return `${q}::${s}::${p}`;
}

function loadResponseCache() {
  try {
    const raw = window.localStorage.getItem(RESPONSE_CACHE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function saveResponseCache(cache) {
  try {
    const keys = Object.keys(cache);
    if (keys.length > RESPONSE_CACHE_MAX_ENTRIES) {
      const sorted = keys
        .map((key) => ({ key, ts: (cache[key] && cache[key].ts) || 0 }))
        .sort((a, b) => a.ts - b.ts);
      const removeCount = keys.length - RESPONSE_CACHE_MAX_ENTRIES;
      for (let i = 0; i < removeCount; i++) {
        delete cache[sorted[i].key];
      }
    }
    window.localStorage.setItem(RESPONSE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (_error) {
    // Ignore storage failures.
  }
}

function getCachedResponse(query, site, persona) {
  const key = buildResponseCacheKey(query, site, persona);
  const cache = loadResponseCache();
  const entry = cache[key];
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return entry;
}

function setCachedResponse(query, site, persona, data) {
  const key = buildResponseCacheKey(query, site, persona);
  const cache = loadResponseCache();
  cache[key] = { ...data, ts: Date.now() };
  saveResponseCache(cache);
  return Object.keys(cache).length;
}

function clearResponseCache() {
  try {
    window.localStorage.removeItem(RESPONSE_CACHE_STORAGE_KEY);
  } catch (_error) {
    // Ignore storage failures.
  }
}

async function requestOrchestrator(query, siteFilter, persona, handlers = {}) {
  if (!orchestratorUrl) {
    throw new Error("Missing orchestrator function URL. Run launch to update app-config.js.");
  }

  const requestPayload = { query };
  const selectedSite = getRequestSiteFilter(siteFilter);
  const selectedPersona = normalizePersonaName(persona);
  if (selectedSite) {
    requestPayload.site = selectedSite;
  }
  requestPayload.persona = selectedPersona;

  const response = await fetch(orchestratorUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const text = await response.text();
    const payload = tryParseJsonResponse(text);
    const normalized = parseLambdaPayload(payload);
    throw new Error(normalized.error || normalized.Message || `Request failed (${response.status}).`);
  }

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/event-stream") && response.body) {
    const streamResult = await consumeOrchestratorEventStream(response.body, handlers);
    return { mode: "stream", result: streamResult };
  }

  const text = await response.text();
  const payload = parseJsonResponse(text);
  const normalized = parseLambdaPayload(payload);
  if (!normalized || typeof normalized !== "object") {
    throw new Error("Unexpected orchestrator response payload.");
  }
  return { mode: "json", result: normalized };
}

async function executeQuery(query, siteFilter, persona, liveAssistant) {
  let routeDetails = null;
  let routeMessageRendered = false;
  let streamRoute = null;
  let streamSources = [];
  let streamAnswer = "";

  const orchestratorResponse = await requestOrchestrator(query, siteFilter, persona, {
    onRoute(payload) {
      const routePayload =
        payload && typeof payload === "object" && payload.route && typeof payload.route === "object"
          ? payload.route
          : payload;
      routeDetails = describeRoute(routePayload);
      streamRoute = routeDetails.route;
      if (!routeMessageRendered) {
        renderRouteMessage(routeDetails, siteFilter);
        routeMessageRendered = true;
      }
      liveAssistant.setMeta(routeDetails.answerMeta);
    },
    onDelta(deltaText) {
      liveAssistant.append(deltaText);
    },
    onDone(payload) {
      if (!payload || typeof payload !== "object") {
        return;
      }
      if (typeof payload.answer === "string") {
        streamAnswer = payload.answer;
      }
      if (Array.isArray(payload.sources)) {
        streamSources = payload.sources;
      }
      if (payload.route && typeof payload.route === "object") {
        streamRoute = payload.route;
      }
    },
  });

  if (orchestratorResponse.mode === "stream") {
    if (!routeDetails && streamRoute) {
      routeDetails = describeRoute(streamRoute);
    }
    if (routeDetails && !routeMessageRendered) {
      renderRouteMessage(routeDetails, siteFilter);
      routeMessageRendered = true;
    }
    if (routeDetails) {
      liveAssistant.setMeta(routeDetails.answerMeta);
    }

    const streamedText = String(streamAnswer || liveAssistant.getText() || "").trim();
    const rawAnswer = streamedText || "(no answer field returned)";
    const sources = Array.isArray(streamSources) ? streamSources : [];

    return { rawAnswer, sources, routeDetails, responseMode: "stream" };
  }

  const result = orchestratorResponse.result;
  const route = result.route && typeof result.route === "object" ? result.route : {};
  routeDetails = describeRoute(route);
  renderRouteMessage(routeDetails, siteFilter);

  const rawAnswer = String(result.answer || "").trim() || "(no answer field returned)";
  const sources = Array.isArray(result.sources) ? result.sources : [];

  return { rawAnswer, sources, routeDetails, responseMode: "json" };
}

// Enter sends the request; Shift+Enter inserts a newline.
if (sendButton) {
  sendButton.addEventListener("click", () => {
    nextSubmitTrigger = "send_button";
  });
}

queryInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  if (sendButton.disabled) {
    return;
  }
  nextSubmitTrigger = "enter_key";
  submitComposerForm();
});

composer.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = queryInput.value.trim();
  if (!query) {
    return;
  }

  userHasSubmittedQuery = true;
  cancelPendingStarterMessages();
  const selectedSiteFilter = getSelectedSiteFilter();
  const selectedPersona = getSelectedPersona();
  const submitTrigger = nextSubmitTrigger || "programmatic";
  nextSubmitTrigger = "send_button";
  const queryStartedAt = performance.now();

  const cached = getCachedResponse(query, selectedSiteFilter, selectedPersona);
  trackEvent("query_submitted", {
    query_length: query.length,
    route_count: routes.length,
    has_orchestrator: orchestratorUrl ? 1 : 0,
    site_filter: toAnalyticsSiteFilter(selectedSiteFilter),
    persona: selectedPersona,
    submit_trigger: submitTrigger,
    cache_hit: cached ? 1 : 0,
  });

  sendButton.disabled = true;
  setSendButtonLoading(true);
  queryInput.disabled = true;
  setProcessingBackground(true);
  addMessage("user", query);
  queryInput.value = "";
  let liveAssistant = createLiveAssistantStream("", { metaType: "routing" });

  try {
    if (cached) {
      const routeDetails = describeRoute(cached.route || {});
      renderRouteMessage(routeDetails, selectedSiteFilter);
      const rawAnswer = String(cached.answer || "").trim() || "(no answer field returned)";
      const answer = applyPersonaAnswerVoice(rawAnswer, selectedPersona);
      const sources = Array.isArray(cached.sources) ? cached.sources : [];
      const shouldShowSources = !isInsufficientInformationAnswer(rawAnswer);
      const sourcesMarkdown = shouldShowSources ? buildSourcesMarkdown(sources) : "";

      liveAssistant.setMeta(routeDetails.answerMeta);
      liveAssistant.finalize(answer);
      if (sourcesMarkdown) {
        addMessage("system", sourcesMarkdown.trim(), undefined, {
          renderMarkdown: true,
          disableAutoScroll: true,
        });
      }
      trackEvent("query_succeeded", {
        selected_index: routeDetails.selectedIndex || "none",
        routed_count: routeDetails.routedIndices.length || (routeDetails.selectedIndex ? 1 : 0),
        source_count: sources.length,
        answer_length: answer.length,
        site_filter: toAnalyticsSiteFilter(selectedSiteFilter),
        persona: selectedPersona,
        response_mode: "cache",
        duration_ms: toAnalyticsDurationMs(queryStartedAt),
        submit_trigger: submitTrigger,
      });
      return;
    }

    let queryResult = await executeQuery(query, selectedSiteFilter, selectedPersona, liveAssistant);
    let { rawAnswer, sources, routeDetails, responseMode } = queryResult;
    let retriedAllSites = false;

    if (
      isInsufficientInformationAnswer(rawAnswer) &&
      normalizeSiteFilterValue(selectedSiteFilter) !== SITE_FILTER_ALL
    ) {
      liveAssistant.remove();
      addMessage("system", "Expanding search to all sites\u2026");
      trackEvent("query_retried_all_sites", {
        original_site_filter: toAnalyticsSiteFilter(selectedSiteFilter),
        query_length: query.length,
      });
      liveAssistant = createLiveAssistantStream("", { metaType: "routing" });
      queryResult = await executeQuery(query, SITE_FILTER_ALL, selectedPersona, liveAssistant);
      rawAnswer = queryResult.rawAnswer;
      sources = queryResult.sources;
      routeDetails = queryResult.routeDetails;
      responseMode = queryResult.responseMode;
      retriedAllSites = true;
    }

    const answer = applyPersonaAnswerVoice(rawAnswer, selectedPersona);
    liveAssistant.finalize(answer);

    const shouldShowSources = !isInsufficientInformationAnswer(rawAnswer);
    const sourcesMarkdown = shouldShowSources ? buildSourcesMarkdown(sources) : "";
    if (sourcesMarkdown) {
      addMessage("system", sourcesMarkdown.trim(), undefined, {
        renderMarkdown: true,
        disableAutoScroll: true,
      });
    }

    const cacheSize = setCachedResponse(query, selectedSiteFilter, selectedPersona, {
      answer: rawAnswer,
      sources,
      route: routeDetails ? routeDetails.route : {},
    });
    trackEvent("cache_entry_stored", {
      answer_length: rawAnswer.length,
      source_count: sources.length,
      cache_size: cacheSize,
    });

    const selectedIndex = routeDetails ? routeDetails.selectedIndex : "";
    const routedCount = routeDetails
      ? routeDetails.routedIndices.length || (routeDetails.selectedIndex ? 1 : 0)
      : 0;
    trackEvent("query_succeeded", {
      selected_index: selectedIndex || "none",
      routed_count: routedCount,
      source_count: sources.length,
      answer_length: answer.length,
      site_filter: toAnalyticsSiteFilter(selectedSiteFilter),
      persona: selectedPersona,
      response_mode: responseMode,
      retried_all_sites: retriedAllSites ? 1 : 0,
      duration_ms: toAnalyticsDurationMs(queryStartedAt),
      submit_trigger: submitTrigger,
    });
  } catch (error) {
    if (!liveAssistant.getText()) {
      liveAssistant.remove();
    }
    addMessage("system", String(error.message || error), "orchestrator");
    trackEvent("query_failed", {
      error_type: classifyErrorType(error),
      site_filter: toAnalyticsSiteFilter(selectedSiteFilter),
      persona: selectedPersona,
      duration_ms: toAnalyticsDurationMs(queryStartedAt),
      submit_trigger: submitTrigger,
    });
  } finally {
    setProcessingBackground(false);
    setSendButtonLoading(false);
    sendButton.disabled = false;
    queryInput.disabled = false;
  }
});

const starterSystemMessage = routes.length
  ? orchestratorUrl
    ? "Get clear answers about court procedures, legal forms, and the court process."
    : "Missing orchestrator URL in app-config.js. Re-run launch."
  : "No hardcoded routes found. Run launch to generate app-config.js.";

if (routes.length && orchestratorUrl) {
  starterMessageTimeoutId = window.setTimeout(() => {
    starterMessageTimeoutId = null;
    if (userHasSubmittedQuery) {
      return;
    }
    addMessage("system", starterSystemMessage);
    starterFollowupTimeoutId = window.setTimeout(() => {
      starterFollowupTimeoutId = null;
      if (userHasSubmittedQuery) {
        return;
      }
      addMessage(
        "system",
        "CalQuery connects your questions to trusted court information and official self-help resources."
      );
    }, STARTER_FOLLOWUP_MESSAGE_DELAY_MS);
  }, STARTER_MESSAGE_DELAY_MS);
} else {
  addMessage("system", starterSystemMessage);
}

starterQueryTimeoutId = window.setTimeout(() => {
  starterQueryTimeoutId = null;
  if (userHasSubmittedQuery) {
    return;
  }
  addStarterQueryMessage(STARTER_QUERIES);
}, STARTER_QUERY_MESSAGE_DELAY_MS);

trackEvent("app_loaded", {
  route_count: routes.length,
  has_orchestrator: orchestratorUrl ? 1 : 0,
  site_filter: toAnalyticsSiteFilter(getSelectedSiteFilter()),
  persona: getSelectedPersona(),
});
