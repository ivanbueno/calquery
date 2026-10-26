"use strict";

// Turns a finished answer's numbered steps into steps that open one at a time.
// Two rendered shapes qualify, and every step needs a bold title and detail after it:
//   1. one list whose items start with a bold title ("1. **File it**: detail")
//   2. the renderer's split form, where each title is its own numbered list and its
//      detail follows as separate blocks ("1. **File it**" then an indented paragraph)
// Any other answer is left exactly as rendered.
const ANSWER_STEP_LEAD_TRIM = /^[\s:.–—-]+/;
const ANSWER_STEP_TITLE_TRIM = /[\s:.–—-]+$/;

function hasText(nodes) {
  return nodes.some((node) => node.textContent.replace(ANSWER_STEP_LEAD_TRIM, "").trim());
}

// A list item that starts with <strong>, directly or inside its first paragraph.
function readTitledItem(item) {
  let titleNode = item.firstElementChild;
  let host = item;
  if (titleNode && titleNode.tagName === "P") {
    host = titleNode;
    titleNode = titleNode.firstElementChild;
  }
  if (!titleNode || titleNode.tagName !== "STRONG" || host.firstChild !== titleNode) {
    return null;
  }
  const title = titleNode.textContent.replace(ANSWER_STEP_TITLE_TRIM, "").trim();
  return title ? { item, host, titleNode, title } : null;
}

function takeItemDetail({ item, host, titleNode }) {
  titleNode.remove();
  const lead = host.firstChild;
  if (lead && lead.nodeType === 3) {
    lead.textContent = lead.textContent.replace(ANSWER_STEP_LEAD_TRIM, "");
  }
  if (host !== item && !host.firstChild) {
    host.remove();
  }
  return Array.from(item.childNodes);
}

function listItems(list) {
  return Array.from(list.children).filter((child) => child.tagName === "LI");
}

function listStart(list) {
  const start = Number.parseInt(list.getAttribute("start") || "1", 10);
  return Number.isFinite(start) ? start : 1;
}

// Shape 1: a single list of titled items.
function readWholeList(list) {
  const items = listItems(list);
  const titled = items.map(readTitledItem);
  if (items.length < 2 || titled.some((entry) => !entry)) {
    return null;
  }
  const detailed = titled.every(({ item, titleNode }) => {
    const text = item.textContent;
    return text.slice(text.indexOf(titleNode.textContent) + titleNode.textContent.length)
      .replace(ANSWER_STEP_LEAD_TRIM, "").trim();
  });
  return detailed ? titled : null;
}

// Shape 2: a title-only list of one item, as the renderer emits before indented detail.
function readTitleOnlyList(element) {
  if (!element || element.tagName !== "OL") {
    return null;
  }
  const items = listItems(element);
  if (items.length !== 1) {
    return null;
  }
  const titled = readTitledItem(items[0]);
  if (!titled || items[0].textContent.trim() !== titled.titleNode.textContent.trim()) {
    return null;
  }
  return titled;
}

function readSplitRun(children, startIndex) {
  const groups = [];
  let index = startIndex;
  while (index < children.length) {
    const titled = readTitleOnlyList(children[index]);
    if (!titled || (groups.length && listStart(children[index]) !== listStart(groups[groups.length - 1].list) + 1)) {
      break;
    }
    const detail = [];
    let next = index + 1;
    while (next < children.length && !readTitleOnlyList(children[next])) {
      detail.push(children[next]);
      next += 1;
    }
    groups.push({ list: children[index], titled, detail });
    index = next;
  }
  if (groups.length < 2) {
    return null;
  }
  // The last title owns only the block right after it; anything later is the answer's own text.
  const last = groups[groups.length - 1];
  last.detail = last.detail.slice(0, 1);
  if (groups.some((group) => !group.detail.length || !hasText(group.detail))) {
    return null;
  }
  return groups;
}

function buildSteps(doc, entries, listId) {
  const list = doc.createElement("ol");
  list.className = "answer-steps";
  const toggles = entries.map((entry, index) => {
    const item = doc.createElement("li");
    item.className = "answer-step";

    const body = doc.createElement("div");
    body.className = "answer-step-body";
    body.id = `${listId}-body-${index + 1}`;
    entry.nodes.forEach((node) => body.appendChild(node));

    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.className = "answer-step-toggle";
    toggle.setAttribute("aria-controls", body.id);
    const label = doc.createElement("span");
    label.className = "answer-step-title";
    label.textContent = entry.title;
    const sign = doc.createElement("span");
    sign.className = "answer-step-sign";
    sign.setAttribute("aria-hidden", "true");
    toggle.append(label, sign);

    item.append(toggle, body);
    list.appendChild(item);
    return { toggle, body, sign };
  });

  const head = doc.createElement("div");
  head.className = "answer-steps-head";
  const count = doc.createElement("span");
  count.className = "answer-steps-count";
  count.textContent = `${entries.length} steps`;
  const all = doc.createElement("button");
  all.type = "button";
  all.className = "answer-steps-all";
  head.append(count, all);

  const setOpen = (entry, open) => {
    entry.toggle.setAttribute("aria-expanded", String(open));
    entry.body.hidden = !open;
    entry.sign.textContent = open ? "−" : "+";
  };
  const syncAll = () => {
    const allOpen = toggles.every((entry) => !entry.body.hidden);
    all.textContent = allOpen ? "Close all" : "Open all";
    all.setAttribute("aria-expanded", String(allOpen));
  };
  toggles.forEach((entry, index) => {
    setOpen(entry, index === 0);
    entry.toggle.addEventListener("click", () => {
      setOpen(entry, entry.body.hidden);
      syncAll();
    });
  });
  all.addEventListener("click", () => {
    const open = !toggles.every((entry) => !entry.body.hidden);
    toggles.forEach((entry) => setOpen(entry, open));
    syncAll();
  });
  syncAll();
  return { head, list };
}

function enhanceAnswerSteps(container, idPrefix = "answer-step") {
  if (!container || !container.children) {
    return 0;
  }
  const doc = container.ownerDocument;
  const children = Array.from(container.children);
  let enhanced = 0;
  let index = 0;

  while (index < children.length) {
    const element = children[index];
    const split = readSplitRun(children, index);
    const whole = !split && element.tagName === "OL" ? readWholeList(element) : null;
    if (!split && !whole) {
      index += 1;
      continue;
    }

    enhanced += 1;
    const listId = `${idPrefix}-${enhanced}`;
    const entries = split
      ? split.map((group) => ({ title: group.titled.title, nodes: group.detail }))
      : whole.map((titled) => ({ title: titled.title, nodes: takeItemDetail(titled) }));
    const { head, list } = buildSteps(doc, entries, listId);
    container.insertBefore(head, element);
    container.insertBefore(list, element);

    if (split) {
      split.forEach((group) => group.list.remove());
      const lastDetail = split[split.length - 1].detail[0];
      index = children.indexOf(lastDetail) + 1;
    } else {
      element.remove();
      index += 1;
    }
  }

  return enhanced;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { enhanceAnswerSteps };
}
