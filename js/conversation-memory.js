"use strict";

// Memory lasts for this page only; each request carries its own bounded history.
class ConversationMemory {
  constructor() {
    this.messages = [];
  }

  snapshot() {
    return ConversationMemory.normalize(this.messages);
  }

  remember(query, answer) {
    this.messages = ConversationMemory.normalize([
      ...this.messages,
      { role: "user", content: query },
      { role: "assistant", content: answer },
    ]);
  }

  clear() {
    this.messages = [];
  }

  static normalize(messages) {
    if (!Array.isArray(messages)) {
      return [];
    }
    const result = [];
    let remaining = 24000;
    for (const message of messages.slice(-10).reverse()) {
      if (!message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string") {
        continue;
      }
      let content = message.content.trim();
      if (!content || remaining <= 0) {
        continue;
      }
      const limit = Math.min(6000, remaining);
      if (content.length > limit) {
        const marker = "\n[…]\n";
        const headLength = Math.floor((limit - marker.length) / 2);
        content = limit <= marker.length
          ? content.slice(-limit)
          : content.slice(0, headLength) + marker + content.slice(-(limit - marker.length - headLength));
      }
      result.unshift({ role: message.role, content });
      remaining -= content.length;
    }
    return result;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ConversationMemory;
}
