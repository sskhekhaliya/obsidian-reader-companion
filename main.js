"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ReaderCompanionPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian8 = require("obsidian");

// src/types.ts
var HIGHLIGHT_COLORS = [
  { name: "Yellow", hex: "#fbbc04", bgLight: "#fef7e0", textLight: "#202124", bgDark: "#3e3215", textDark: "#fef0b3" },
  { name: "Red", hex: "#ea4335", bgLight: "#fce8e6", textLight: "#202124", bgDark: "#4a1816", textDark: "#f8d7da" },
  { name: "Green", hex: "#34a853", bgLight: "#e6f4ea", textLight: "#202124", bgDark: "#133820", textDark: "#ceead6" },
  { name: "Blue", hex: "#1a73e8", bgLight: "#e8f0fe", textLight: "#202124", bgDark: "#1a2d4b", textDark: "#d2e3fc" },
  { name: "Purple", hex: "#a142f4", bgLight: "#f3e8fd", textLight: "#202124", bgDark: "#351a4b", textDark: "#e9d5ff" }
];
var DEFAULT_SETTINGS = {
  defaultColor: "#fbbc04",
  targetLanguage: "en",
  googleApiKey: "",
  enableInReadingMode: true,
  enableInEditingMode: false,
  uiTheme: "auto",
  autoPronounce: false,
  showSearchVault: true,
  minSelectionLength: 1,
  enableVocabulary: true,
  autoSaveVocabulary: true,
  vocabularyFilePath: "Vocabulary.md",
  vocabularyHeadingLevel: "h3",
  addVocabularyProperty: true,
  vocabularyPropertyKey: "type",
  vocabularyPropertyValue: "vocabulary"
};

// src/storage.ts
var import_obsidian = require("obsidian");
var StorageManager = class extends import_obsidian.Events {
  constructor(plugin) {
    super();
    this.plugin = plugin;
  }
  getAnnotationsForFile(filePath) {
    const list = this.plugin.data.annotations[filePath] || [];
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }
  hasAnnotationsForFile(filePath) {
    const list = this.plugin.data.annotations[filePath];
    return !!(list && list.length > 0);
  }
  getAllAnnotations() {
    const all = [];
    for (const filePath of Object.keys(this.plugin.data.annotations)) {
      all.push(...this.plugin.data.annotations[filePath]);
    }
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }
  findAnnotation(filePath, text) {
    const list = this.getAnnotationsForFile(filePath);
    const clean = text.trim();
    if (!clean) return void 0;
    const cleanNorm = clean.replace(/\s+/g, " ");
    return list.find((a) => {
      const aText = a.text.trim();
      return aText === clean || aText.replace(/\s+/g, " ") === cleanNorm || clean.length > 8 && aText.includes(clean) || aText.length > 8 && clean.includes(aText);
    });
  }
  getAnnotationById(id) {
    for (const filePath of Object.keys(this.plugin.data.annotations)) {
      const found = this.plugin.data.annotations[filePath]?.find((a) => a.id === id);
      if (found) return found;
    }
    return void 0;
  }
  async addAnnotation(item) {
    const now = Date.now();
    const id = `rc_${now}_${Math.random().toString(36).substring(2, 9)}`;
    const newAnnotation = {
      id,
      filePath: item.filePath,
      fileTitle: item.fileTitle || "Untitled",
      text: item.text,
      color: item.color,
      note: item.note?.trim() || void 0,
      createdAt: now,
      updatedAt: now
    };
    if (!this.plugin.data.annotations[item.filePath]) {
      this.plugin.data.annotations[item.filePath] = [];
    }
    this.plugin.data.annotations[item.filePath].push(newAnnotation);
    await this.plugin.savePluginData();
    this.trigger("changed", item.filePath);
    return newAnnotation;
  }
  async updateAnnotation(id, updates) {
    for (const filePath of Object.keys(this.plugin.data.annotations)) {
      const list = this.plugin.data.annotations[filePath];
      const index = list.findIndex((a) => a.id === id);
      if (index !== -1) {
        list[index] = {
          ...list[index],
          ...updates,
          updatedAt: Date.now()
        };
        await this.plugin.savePluginData();
        this.trigger("changed", filePath);
        return true;
      }
    }
    return false;
  }
  async deleteAnnotation(id) {
    for (const filePath of Object.keys(this.plugin.data.annotations)) {
      const list = this.plugin.data.annotations[filePath];
      const index = list.findIndex((a) => a.id === id);
      if (index !== -1) {
        list.splice(index, 1);
        if (list.length === 0) {
          delete this.plugin.data.annotations[filePath];
        }
        await this.plugin.savePluginData();
        this.trigger("changed", filePath);
        return true;
      }
    }
    return false;
  }
  async clearFile(filePath) {
    if (this.plugin.data.annotations[filePath]) {
      delete this.plugin.data.annotations[filePath];
      await this.plugin.savePluginData();
      this.trigger("changed", filePath);
    }
  }
  /**
   * Handles vault rename/move events for files and folders.
   * Updates dictionary keys and every annotation's filePath and fileTitle.
   */
  async handleRename(oldPath, newPath, newTitle) {
    if (!oldPath || !newPath || oldPath === newPath) return false;
    let modified = false;
    if (this.plugin.data.annotations[oldPath]) {
      const oldList = this.plugin.data.annotations[oldPath];
      for (const item of oldList) {
        item.filePath = newPath;
        if (newTitle) {
          item.fileTitle = newTitle;
        }
      }
      if (this.plugin.data.annotations[newPath]) {
        const existingIds = new Set(this.plugin.data.annotations[newPath].map((a) => a.id));
        for (const item of oldList) {
          if (!existingIds.has(item.id)) {
            this.plugin.data.annotations[newPath].push(item);
          }
        }
      } else {
        this.plugin.data.annotations[newPath] = oldList;
      }
      delete this.plugin.data.annotations[oldPath];
      modified = true;
    }
    const oldPrefix = oldPath.endsWith("/") ? oldPath : oldPath + "/";
    const newPrefix = newPath.endsWith("/") ? newPath : newPath + "/";
    for (const key of Object.keys(this.plugin.data.annotations)) {
      if (key.startsWith(oldPrefix)) {
        const suffix = key.slice(oldPrefix.length);
        const updatedKey = newPrefix + suffix;
        const list = this.plugin.data.annotations[key];
        for (const item of list) {
          item.filePath = updatedKey;
        }
        if (this.plugin.data.annotations[updatedKey]) {
          const existingIds = new Set(this.plugin.data.annotations[updatedKey].map((a) => a.id));
          for (const item of list) {
            if (!existingIds.has(item.id)) {
              this.plugin.data.annotations[updatedKey].push(item);
            }
          }
        } else {
          this.plugin.data.annotations[updatedKey] = list;
        }
        delete this.plugin.data.annotations[key];
        modified = true;
      }
    }
    if (modified) {
      await this.plugin.savePluginData();
      this.trigger("changed", newPath);
      return true;
    }
    return false;
  }
  /**
   * Dynamically resolves a file across the vault even if it has moved or renamed.
   * Auto-heals and migrates the stored annotation location when matched.
   */
  async resolveFile(filePath, fileTitle, sampleText) {
    const direct = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (direct instanceof import_obsidian.TFile) {
      return direct;
    }
    const destByPath = this.plugin.app.metadataCache.getFirstLinkpathDest(filePath, "");
    if (destByPath instanceof import_obsidian.TFile) {
      await this.handleRename(filePath, destByPath.path, destByPath.basename);
      return destByPath;
    }
    if (fileTitle) {
      const destByTitle = this.plugin.app.metadataCache.getFirstLinkpathDest(fileTitle, "");
      if (destByTitle instanceof import_obsidian.TFile) {
        await this.handleRename(filePath, destByTitle.path, destByTitle.basename);
        return destByTitle;
      }
    }
    const mdFiles = this.plugin.app.vault.getMarkdownFiles();
    const targetFileName = filePath.split("/").pop() || "";
    const cleanTitle = fileTitle || (targetFileName.endsWith(".md") ? targetFileName.slice(0, -3) : targetFileName);
    const candidates = mdFiles.filter((f) => {
      return f.name === targetFileName || f.basename === cleanTitle || f.name.toLowerCase() === targetFileName.toLowerCase() || f.basename.toLowerCase() === cleanTitle.toLowerCase();
    });
    if (candidates.length === 1) {
      const matched = candidates[0];
      await this.handleRename(filePath, matched.path, matched.basename);
      return matched;
    }
    if (candidates.length > 1) {
      if (sampleText && sampleText.trim().length > 5) {
        const cleanSample = sampleText.trim();
        for (const cand of candidates) {
          try {
            const content = await this.plugin.app.vault.cachedRead(cand);
            if (content.includes(cleanSample)) {
              await this.handleRename(filePath, cand.path, cand.basename);
              return cand;
            }
          } catch {
          }
        }
      }
      const matched = candidates[0];
      await this.handleRename(filePath, matched.path, matched.basename);
      return matched;
    }
    if (sampleText && sampleText.trim().length >= 20) {
      const cleanSample = sampleText.trim();
      for (const file of mdFiles) {
        try {
          const content = await this.plugin.app.vault.cachedRead(file);
          if (content.includes(cleanSample)) {
            await this.handleRename(filePath, file.path, file.basename);
            return file;
          }
        } catch {
        }
      }
    }
    return null;
  }
  /**
   * Checks if an opened file has orphaned annotations stored under an old or moved path,
   * and heals them dynamically.
   */
  async checkAndHealForFile(file) {
    if (this.hasAnnotationsForFile(file.path)) {
      return false;
    }
    const deadKeys = [];
    for (const key of Object.keys(this.plugin.data.annotations)) {
      const exists = this.plugin.app.vault.getAbstractFileByPath(key);
      if (!exists) {
        deadKeys.push(key);
      }
    }
    if (deadKeys.length === 0) return false;
    let healed = false;
    let fileContent = null;
    for (const deadKey of deadKeys) {
      const items = this.plugin.data.annotations[deadKey];
      if (!items || items.length === 0) continue;
      const firstItem = items[0];
      const deadFileName = deadKey.split("/").pop() || "";
      const matchesName = deadFileName === file.name || firstItem.fileTitle === file.basename || deadFileName.toLowerCase() === file.name.toLowerCase() || firstItem.fileTitle.toLowerCase() === file.basename.toLowerCase();
      if (matchesName) {
        if (firstItem.text && firstItem.text.trim().length > 5) {
          if (fileContent === null) {
            try {
              fileContent = await this.plugin.app.vault.cachedRead(file);
            } catch {
              fileContent = "";
            }
          }
          if (fileContent && !fileContent.includes(firstItem.text.trim())) {
            continue;
          }
        }
        await this.handleRename(deadKey, file.path, file.basename);
        healed = true;
        break;
      }
    }
    return healed;
  }
  /**
   * Scans all stored annotations across the vault and resolves/heals any paths that no longer exist.
   */
  async reconcileAnnotations() {
    let healedCount = 0;
    const paths = Object.keys(this.plugin.data.annotations);
    for (const path of paths) {
      const abstractFile = this.plugin.app.vault.getAbstractFileByPath(path);
      if (abstractFile instanceof import_obsidian.TFile) {
        const items2 = this.plugin.data.annotations[path] || [];
        let titleChanged = false;
        for (const item of items2) {
          if (item.fileTitle !== abstractFile.basename) {
            item.fileTitle = abstractFile.basename;
            titleChanged = true;
          }
        }
        if (titleChanged) {
          healedCount++;
        }
        continue;
      }
      const items = this.plugin.data.annotations[path];
      if (!items || items.length === 0) {
        delete this.plugin.data.annotations[path];
        continue;
      }
      const sample = items[0];
      const resolved = await this.resolveFile(path, sample.fileTitle, sample.text);
      if (resolved) {
        healedCount++;
      }
    }
    if (healedCount > 0) {
      await this.plugin.savePluginData();
      this.trigger("changed", "");
    }
    return healedCount;
  }
};

// src/highlighter.ts
var DomHighlighter = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  /**
   * Applies inline highlight marks across the reading mode container
   * without touching the markdown note on disk.
   */
  applyHighlights(container, filePath) {
    const annotations = this.plugin.storage.getAnnotationsForFile(filePath);
    if (!annotations || annotations.length === 0) {
      this.clearHighlights(container);
      return;
    }
    this.clearHighlights(container);
    for (const item of annotations) {
      this.highlightTextInContainer(container, item);
    }
  }
  clearHighlights(container) {
    const marks = container.querySelectorAll("mark.rc-inline-highlight");
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
        parent.normalize();
      }
    });
  }
  highlightTextInContainer(container, item) {
    const targetText = item.text.trim();
    if (!targetText) return;
    const normalizedTarget = targetText.replace(/\s+/g, " ");
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.textContent) return NodeFilter.FILTER_SKIP;
        const normalizedContent = node.textContent.replace(/\s+/g, " ");
        if (!normalizedContent.includes(normalizedTarget)) {
          return NodeFilter.FILTER_SKIP;
        }
        const parent = node.parentElement;
        if (parent && (parent.tagName === "MARK" || parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.tagName === "BUTTON")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const matchingNodes = [];
    let curr;
    while (curr = walker.nextNode()) {
      matchingNodes.push(curr);
    }
    for (const node of matchingNodes) {
      if (!node.textContent) continue;
      const index = node.textContent.indexOf(targetText);
      const matchIndex = index !== -1 ? index : node.textContent.replace(/\s+/g, " ").indexOf(normalizedTarget);
      if (matchIndex === -1) continue;
      try {
        const range = document.createRange();
        range.setStart(node, matchIndex);
        range.setEnd(node, Math.min(node.textContent.length, matchIndex + targetText.length));
        const mark = document.createElement("mark");
        mark.className = "rc-inline-highlight";
        mark.dataset.rcId = item.id;
        mark.style.setProperty("background-color", item.color + "45", "important");
        mark.style.setProperty("border-bottom", "2px solid " + item.color, "important");
        if (item.note) {
          mark.title = `Note: ${item.note}`;
          mark.classList.add("has-note");
        }
        mark.addEventListener("click", (e) => {
          e.stopPropagation();
          this.plugin.openNoteModal({
            initialText: item.text,
            initialNote: item.note,
            initialColor: item.color,
            isExisting: true,
            coords: {
              x: e.clientX,
              y: e.clientY
            },
            onSave: async (newNote, newColor) => {
              await this.plugin.storage.updateAnnotation(item.id, {
                note: newNote,
                color: newColor
              });
            },
            onDelete: async () => {
              await this.plugin.storage.deleteAnnotation(item.id);
            },
            onViewInPanel: () => {
              this.plugin.activateView();
            }
          });
        });
        mark.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.plugin.openHighlightMenu(item, {
            x: e.clientX,
            y: e.clientY,
            bottomY: e.clientY + 20
          });
        });
        range.surroundContents(mark);
      } catch {
      }
    }
  }
};

// src/ui/icons.ts
var ICONS = {
  addNote: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>`,
  translate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <path d="m5 8 6 6" />
    <path d="m4 14 6-6 2-3" />
    <path d="M2 5h12" />
    <path d="M7 2h1" />
    <path d="m22 22-5-10-5 10" />
    <path d="M14 18h6" />
  </svg>`,
  define: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>`,
  volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
  </svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>`,
  externalLink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <polyline points="20 6 9 17 4 12" />
  </svg>`,
  highlighter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <path d="m9 11-6 6v3h3l6-6" />
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
  </svg>`,
  bookOpen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>`,
  moreVertical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>`,
  bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
  </svg>`,
  bookmarkCheck: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rc-icon">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
  </svg>`
};

// src/ui/selection-menu.ts
var SelectionMenu = class {
  constructor(callbacks) {
    this.el = null;
    this.coords = { x: 0, y: 0 };
    this.text = "";
    this.cleanWord = "";
    this.isSingleWord = false;
    this.keydownHandler = null;
    this.outsidePointerHandler = null;
    this.callbacks = callbacks;
  }
  show(coords, text, existing) {
    this.hide();
    this.coords = { ...coords };
    this.text = text.trim();
    this.existing = existing;
    if (!this.text) return;
    this.cleanWord = this.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    const words = this.text.split(/\s+/).filter(Boolean);
    this.isSingleWord = words.length === 1 && this.cleanWord.length > 0;
    this.el = document.createElement("div");
    this.el.className = "rc-selection-menu";
    const listEl = document.createElement("div");
    listEl.className = "rc-menu-list";
    const noteIcon = this.existing?.note ? ICONS.edit : ICONS.addNote;
    const noteLabel = this.existing?.note ? "Edit note" : "Add note";
    this.createMenuItem(listEl, noteIcon, noteLabel, () => {
      const savedCoords = { ...this.coords };
      const savedExisting = this.existing;
      this.hide();
      this.callbacks.onAddNote(this.text, savedCoords, savedExisting);
    });
    this.createMenuItem(listEl, ICONS.copy, "Copy", () => {
      this.hide();
      this.callbacks.onCopy(this.text);
    });
    this.createMenuItem(listEl, ICONS.translate, "Translate", () => {
      const savedCoords = { ...this.coords };
      this.hide();
      this.callbacks.onTranslate(this.text, savedCoords);
    });
    if (this.isSingleWord) {
      this.createMenuItem(listEl, ICONS.define, "Define", () => {
        const savedCoords = { ...this.coords };
        this.hide();
        this.callbacks.onDefine(this.cleanWord, savedCoords);
      });
    }
    const canShowVocab = !this.callbacks.shouldShowAddToVocabulary || this.callbacks.shouldShowAddToVocabulary();
    if (this.isSingleWord && this.callbacks.onAddToVocabulary && canShowVocab) {
      this.createMenuItem(listEl, ICONS.bookmark, "Add to vocabulary", () => {
        const savedCoords = { ...this.coords };
        this.hide();
        this.callbacks.onAddToVocabulary(this.cleanWord, savedCoords);
      });
    }
    this.createMenuItem(listEl, ICONS.search, "Search vault", () => {
      this.hide();
      this.callbacks.onSearchVault(this.text);
    });
    if (this.existing && this.callbacks.onDeleteHighlight) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "rc-menu-item danger";
      delBtn.innerHTML = `<span class="rc-item-icon">${ICONS.trash}</span><span class="rc-item-label">Remove highlight</span>`;
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = this.existing?.id;
        this.hide();
        if (id) this.callbacks.onDeleteHighlight?.(id);
      });
      listEl.appendChild(delBtn);
    }
    this.el.appendChild(listEl);
    const colorRow = document.createElement("div");
    colorRow.className = "rc-color-row";
    for (const color of HIGHLIGHT_COLORS) {
      const dot = document.createElement("button");
      dot.type = "button";
      const isCurrentColor = this.existing?.color.toLowerCase() === color.hex.toLowerCase();
      dot.className = "rc-color-dot" + (isCurrentColor ? " active" : "");
      dot.style.backgroundColor = color.hex;
      dot.title = isCurrentColor ? `Current color (${color.name})` : `Highlight in ${color.name}`;
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        const existingId = this.existing?.id;
        this.hide();
        this.callbacks.onHighlight(this.text, color.hex, existingId);
      });
      colorRow.appendChild(dot);
    }
    this.el.appendChild(colorRow);
    document.body.appendChild(this.el);
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const vx = window.visualViewport?.offsetLeft ?? 0;
    const vy = window.visualViewport?.offsetTop ?? 0;
    const menuWidth = 185;
    const estimatedHeight = (this.isSingleWord ? 240 : 200) + (this.existing ? 35 : 0);
    let posX = coords.x;
    const halfWidth = menuWidth / 2;
    posX = Math.max(vx + halfWidth + 10, Math.min(vx + vw - halfWidth - 10, posX));
    const spaceAbove = coords.y - vy;
    const bottomTarget = coords.bottomY ?? coords.y + 24;
    const spaceBelow = vy + vh - bottomTarget;
    let topPos;
    let translateY;
    if (spaceAbove >= estimatedHeight + 15) {
      topPos = Math.max(vy + 10, coords.y - 10);
      translateY = "-100%";
    } else if (spaceBelow >= estimatedHeight + 15) {
      topPos = Math.min(vy + vh - estimatedHeight - 10, bottomTarget + 10);
      translateY = "0%";
    } else {
      if (spaceBelow >= spaceAbove) {
        topPos = Math.max(vy + 10, Math.min(vy + vh - estimatedHeight - 10, bottomTarget + 6));
        translateY = "0%";
      } else {
        topPos = Math.max(vy + estimatedHeight + 10, coords.y - 6);
        translateY = "-100%";
      }
    }
    this.el.style.setProperty("--rc-translate-y", translateY);
    this.el.style.left = `${Math.round(posX)}px`;
    this.el.style.top = `${Math.round(topPos)}px`;
    this.el.style.transform = `translate(-50%, ${translateY})`;
    this.el.addEventListener("mousedown", (e) => e.stopPropagation());
    this.el.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    this.el.addEventListener("touchend", (e) => e.stopPropagation());
    this.el.addEventListener("click", (e) => e.stopPropagation());
    setTimeout(() => {
      this.outsidePointerHandler = (e) => {
        const target = e instanceof MouseEvent ? e.target : e.touches?.[0]?.target || e.target;
        if (this.el && target && !this.el.contains(target)) {
          this.hide();
        }
      };
      this.keydownHandler = (e) => {
        if (e.key === "Escape") {
          this.hide();
        }
      };
      document.addEventListener("mousedown", this.outsidePointerHandler);
      document.addEventListener("touchstart", this.outsidePointerHandler, { passive: true });
      document.addEventListener("keydown", this.keydownHandler);
    }, 60);
  }
  createMenuItem(container, iconSvg, title, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rc-menu-item";
    btn.innerHTML = `<span class="rc-item-icon">${iconSvg}</span><span class="rc-item-label">${title}</span>`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    container.appendChild(btn);
  }
  hide() {
    if (this.outsidePointerHandler) {
      document.removeEventListener("mousedown", this.outsidePointerHandler);
      document.removeEventListener("touchstart", this.outsidePointerHandler);
      this.outsidePointerHandler = null;
    }
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    this.callbacks.onClose();
  }
  isOpen() {
    return this.el !== null;
  }
};

// src/ui/definition-modal.ts
var import_obsidian3 = require("obsidian");

// src/dictionary.ts
var import_obsidian2 = require("obsidian");
var DictionaryService = class {
  /**
   * Look up definition using Free Dictionary API, with fallback to Wiktionary.
   * Automatically resolves inflected/plural forms (e.g. "interactions" -> "interaction",
   * "peers" -> "peer") so full definitions, phonetics, and examples are always returned.
   */
  static async lookup(rawWord) {
    const cleanWord = rawWord.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!cleanWord) return null;
    let result = await this.lookupDirect(cleanWord);
    const inflectionInfo = result ? this.extractInflectionInfo(result) : null;
    let targetRoot = inflectionInfo?.root;
    if (!targetRoot && (!result || result.meanings.length === 0)) {
      targetRoot = this.guessBaseWord(cleanWord);
    }
    if (targetRoot && targetRoot.toLowerCase() !== cleanWord.toLowerCase()) {
      try {
        const rootResult = await this.lookupDirect(targetRoot);
        if (rootResult && rootResult.meanings && rootResult.meanings.length > 0) {
          return {
            word: cleanWord,
            rootWord: targetRoot,
            inflectionNote: inflectionInfo?.note || `plural/form of ${targetRoot}`,
            phonetic: rootResult.phonetic || result?.phonetic,
            phonetics: rootResult.phonetics && rootResult.phonetics.length > 0 ? rootResult.phonetics : result?.phonetics,
            meanings: rootResult.meanings
          };
        }
      } catch {
      }
    }
    return result;
  }
  static async lookupDirect(word) {
    try {
      const freeDictResult = await this.lookupFreeDict(word);
      if (freeDictResult) return freeDictResult;
    } catch {
    }
    try {
      const wiktionaryResult = await this.lookupWiktionary(word);
      if (wiktionaryResult) return wiktionaryResult;
    } catch {
    }
    return null;
  }
  static extractInflectionInfo(result) {
    if (!result.meanings || result.meanings.length === 0) return null;
    for (const meaning of result.meanings) {
      for (const defObj of meaning.definitions || []) {
        const def = defObj.definition.trim();
        const match = def.match(
          /^(?:plural|third-person\s+singular(?:\s+simple\s+present)?|past\s+tense|past\s+participle|present\s+participle|comparative|superlative|alternative\s+(?:spelling|form))\s+of\s+(?:the\s+)?(?:word\s+)?["'“]?([a-zA-Z\p{L}'-]+)["'”]?\.?$/iu
        );
        if (match && match[1]) {
          return {
            root: match[1].toLowerCase().trim(),
            note: def
          };
        }
      }
    }
    return null;
  }
  static guessBaseWord(word) {
    const lower = word.toLowerCase();
    if (lower.length <= 3) return null;
    if (lower.endsWith("ies") && lower.length > 4) {
      return lower.slice(0, -3) + "y";
    }
    if (lower.endsWith("es") && lower.length > 4) {
      return lower.slice(0, -2);
    }
    if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) {
      return lower.slice(0, -1);
    }
    if (lower.endsWith("ed") && lower.length > 4) {
      return lower.slice(0, -2);
    }
    if (lower.endsWith("ing") && lower.length > 5) {
      return lower.slice(0, -3);
    }
    return null;
  }
  static async lookupFreeDict(word) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`;
    const response = await (0, import_obsidian2.requestUrl)({
      url,
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (response.status === 200 && Array.isArray(response.json) && response.json.length > 0) {
      const item = response.json[0];
      return {
        word: item.word || word,
        phonetic: item.phonetic,
        phonetics: item.phonetics,
        meanings: item.meanings || []
      };
    }
    return null;
  }
  static async lookupWiktionary(word) {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word.toLowerCase())}`;
    const response = await (0, import_obsidian2.requestUrl)({
      url,
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (response.status === 200 && response.json && response.json.en) {
      const sections = response.json.en;
      if (Array.isArray(sections) && sections.length > 0) {
        const meanings = [];
        for (const sec of sections) {
          const partOfSpeech = sec.partOfSpeech || "General";
          const defs = (sec.definitions || []).map((d) => {
            const rawDef = typeof d.definition === "string" ? d.definition : "";
            const cleanDef = rawDef.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
            let example;
            if (Array.isArray(d.examples) && d.examples.length > 0) {
              const rawEx = typeof d.examples[0] === "string" ? d.examples[0] : "";
              const cleanEx = rawEx.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
              if (cleanEx) example = cleanEx;
            }
            return cleanDef ? { definition: cleanDef, example } : null;
          }).filter(Boolean);
          if (defs.length > 0) {
            meanings.push({
              partOfSpeech,
              definitions: defs
            });
          }
        }
        if (meanings.length > 0) {
          return {
            word,
            meanings
          };
        }
      }
    }
    return null;
  }
  /**
   * Preload audio file in memory as soon as definition is loaded
   * so it plays with zero lag.
   */
  static preloadAudio(word, audioUrl) {
    if (!audioUrl) return;
    try {
      const fullUrl = audioUrl.startsWith("//") ? `https:${audioUrl}` : audioUrl;
      const audio = new Audio(fullUrl);
      audio.preload = "auto";
      this.cachedAudios.set(word.toLowerCase(), audio);
    } catch {
    }
  }
  /**
   * Play pronunciation audio instantly or fallback to local SpeechSynthesis.
   */
  static pronounce(word, audioUrl) {
    const cleanWord = word.trim();
    if (!cleanWord) return;
    const cached = this.cachedAudios.get(cleanWord.toLowerCase());
    if (cached && cached.readyState >= 2) {
      cached.currentTime = 0;
      cached.play().catch(() => this.speak(cleanWord));
      return;
    }
    if (audioUrl) {
      try {
        const fullUrl = audioUrl.startsWith("//") ? `https:${audioUrl}` : audioUrl;
        const sound = new Audio(fullUrl);
        let hasPlayed = false;
        const fallbackTimer = setTimeout(() => {
          if (!hasPlayed) {
            hasPlayed = true;
            this.speak(cleanWord);
          }
        }, 250);
        sound.play().then(() => {
          hasPlayed = true;
          clearTimeout(fallbackTimer);
        }).catch(() => {
          clearTimeout(fallbackTimer);
          if (!hasPlayed) {
            hasPlayed = true;
            this.speak(cleanWord);
          }
        });
        return;
      } catch {
      }
    }
    this.speak(cleanWord);
  }
  static speak(word) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const localVoice = voices.find((v) => v.lang.startsWith("en") && v.localService) || voices.find((v) => v.lang.startsWith("en"));
        if (localVoice) {
          utterance.voice = localVoice;
        }
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("SpeechSynthesis error", e);
    }
  }
};
DictionaryService.cachedAudios = /* @__PURE__ */ new Map();

// src/ui/definition-modal.ts
var DefinitionModal = class {
  constructor() {
    this.el = null;
    this.outsidePointerHandler = null;
    this.keydownHandler = null;
  }
  async show(targetOrOptions, legacyWord) {
    this.hide();
    const options = typeof targetOrOptions.rawWord === "string" ? targetOrOptions : { coords: targetOrOptions, rawWord: legacyWord || "" };
    const cleanWord = options.rawWord.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!cleanWord) return;
    this.el = document.createElement("div");
    this.el.className = "rc-popover rc-definition-popover";
    const header = document.createElement("div");
    header.className = "rc-popover-header";
    const title = document.createElement("h3");
    title.className = "rc-popover-title lowercase";
    title.textContent = cleanWord.toLowerCase();
    header.appendChild(title);
    const headerActions = document.createElement("div");
    headerActions.className = "rc-header-actions";
    let vocabBtn = null;
    let isSaved = false;
    let cachedResult = null;
    if (options.enableVocabulary && options.onSaveVocabulary) {
      vocabBtn = document.createElement("button");
      vocabBtn.type = "button";
      vocabBtn.className = "rc-circle-btn rc-vocab-save-btn";
      vocabBtn.title = "Save to Vocabulary";
      vocabBtn.innerHTML = ICONS.bookmark;
      if (options.isWordSaved) {
        options.isWordSaved(cleanWord).then((saved) => {
          if (saved && vocabBtn) {
            isSaved = true;
            vocabBtn.classList.add("saved");
            vocabBtn.title = "Saved in Vocabulary";
            vocabBtn.innerHTML = ICONS.bookmarkCheck;
          }
        });
      }
      vocabBtn.addEventListener("click", async () => {
        if (isSaved) {
          new import_obsidian3.Notice(`"${cleanWord}" is already saved in Vocabulary.`);
          return;
        }
        const res = await options.onSaveVocabulary(
          cachedResult || { word: cleanWord, meanings: [] },
          options.contextSentence
        );
        if (res.success || res.alreadyExists) {
          isSaved = true;
          if (vocabBtn) {
            vocabBtn.classList.add("saved");
            vocabBtn.title = "Saved in Vocabulary";
            vocabBtn.innerHTML = ICONS.bookmarkCheck;
          }
        }
      });
      headerActions.appendChild(vocabBtn);
    }
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "rc-circle-btn";
    closeBtn.title = "Close";
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener("click", () => this.hide());
    headerActions.appendChild(closeBtn);
    header.appendChild(headerActions);
    this.el.appendChild(header);
    const body = document.createElement("div");
    body.className = "rc-popover-body";
    body.innerHTML = `
      <div class="rc-loading-state">
        <div class="rc-spinner"></div>
        <span>Looking up "${cleanWord}"...</span>
      </div>
    `;
    this.el.appendChild(body);
    document.body.appendChild(this.el);
    if (window.innerWidth <= 500) {
      this.el.classList.add("centered");
    } else {
      this.position(options.coords);
    }
    this.el.addEventListener("mousedown", (e) => e.stopPropagation());
    this.el.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    this.el.addEventListener("touchend", (e) => e.stopPropagation());
    this.el.addEventListener("click", (e) => e.stopPropagation());
    setTimeout(() => {
      this.outsidePointerHandler = (e) => {
        const target = e instanceof MouseEvent ? e.target : e.touches?.[0]?.target || e.target;
        if (this.el && target && !this.el.contains(target)) {
          this.hide();
        }
      };
      this.keydownHandler = (e) => {
        if (e.key === "Escape") {
          this.hide();
        }
      };
      document.addEventListener("mousedown", this.outsidePointerHandler);
      document.addEventListener("touchstart", this.outsidePointerHandler, { passive: true });
      document.addEventListener("keydown", this.keydownHandler);
    }, 60);
    try {
      const result = await DictionaryService.lookup(cleanWord);
      if (!this.el) return;
      if (!result) {
        this.renderNotFound(body, cleanWord);
      } else {
        cachedResult = result;
        this.renderResult(body, result);
        if (options.enableVocabulary && options.autoSaveVocabulary && options.onSaveVocabulary && !isSaved) {
          options.onSaveVocabulary(result, options.contextSentence).then((res) => {
            if ((res.success || res.alreadyExists) && vocabBtn) {
              isSaved = true;
              vocabBtn.classList.add("saved");
              vocabBtn.title = "Saved in Vocabulary";
              vocabBtn.innerHTML = ICONS.bookmarkCheck;
            }
          });
        }
      }
    } catch {
      if (!this.el) return;
      this.renderNotFound(body, cleanWord);
    }
  }
  position(coords) {
    if (!this.el) return;
    const estimatedHeight = 350;
    const rawX = typeof coords.x === "number" && !isNaN(coords.x) && coords.x > 0 ? coords.x : window.innerWidth / 2;
    const rawY = typeof coords.y === "number" && !isNaN(coords.y) && coords.y > 0 ? coords.y : window.innerHeight / 3;
    const bottomY = typeof coords.bottomY === "number" && !isNaN(coords.bottomY) ? coords.bottomY : rawY + 20;
    let posX = Math.max(190, Math.min(window.innerWidth - 190, rawX));
    const isNearBottom = rawY + estimatedHeight > window.innerHeight - 60;
    let topPos;
    let transform;
    if (isNearBottom) {
      topPos = Math.max(20, rawY - 12);
      transform = "translate(-50%, -100%)";
    } else {
      topPos = bottomY + 12;
      transform = "translate(-50%, 0)";
    }
    this.el.style.left = `${posX}px`;
    this.el.style.top = `${topPos}px`;
    this.el.style.transform = transform;
  }
  renderResult(body, result) {
    body.innerHTML = "";
    const audioObj = result.phonetics?.find(
      (p) => typeof p.audio === "string" && p.audio.trim().length > 0
    );
    DictionaryService.preloadAudio(result.word, audioObj?.audio);
    const phoneticText = result.phonetic || result.phonetics?.find((p) => p.text && p.text.trim())?.text || "";
    const pronRow = document.createElement("div");
    pronRow.className = "rc-pronunciation-row";
    if (phoneticText) {
      const phonSpan = document.createElement("span");
      phonSpan.className = "rc-phonetic-text";
      phonSpan.textContent = phoneticText;
      pronRow.appendChild(phonSpan);
    }
    const speakerBtn = document.createElement("button");
    speakerBtn.type = "button";
    speakerBtn.className = "rc-icon-button";
    speakerBtn.title = "Pronounce word";
    speakerBtn.innerHTML = ICONS.volume;
    speakerBtn.addEventListener("click", () => {
      DictionaryService.pronounce(result.word, audioObj?.audio);
    });
    pronRow.appendChild(speakerBtn);
    body.appendChild(pronRow);
    if (result.inflectionNote) {
      const inflectDiv = document.createElement("div");
      inflectDiv.className = "rc-inflection-tag";
      inflectDiv.textContent = `(${result.inflectionNote})`;
      body.appendChild(inflectDiv);
    }
    if (result.meanings && result.meanings.length > 0) {
      for (const meaning of result.meanings) {
        const meaningBlock = document.createElement("div");
        meaningBlock.className = "rc-meaning-block";
        const posHeader = document.createElement("div");
        posHeader.className = "rc-part-of-speech";
        posHeader.textContent = meaning.partOfSpeech;
        meaningBlock.appendChild(posHeader);
        if (meaning.definitions && meaning.definitions.length > 0) {
          const defList = document.createElement("div");
          defList.className = "rc-definitions-list";
          meaning.definitions.slice(0, 4).forEach((def, idx) => {
            const defItem = document.createElement("div");
            defItem.className = "rc-definition-item";
            const numSpan = document.createElement("span");
            numSpan.className = "rc-def-num";
            numSpan.textContent = `${idx + 1}.`;
            defItem.appendChild(numSpan);
            const contentDiv = document.createElement("div");
            contentDiv.className = "rc-def-content";
            const defP = document.createElement("p");
            defP.className = "rc-def-text";
            defP.textContent = def.definition;
            contentDiv.appendChild(defP);
            if (def.example) {
              const exP = document.createElement("p");
              exP.className = "rc-def-example";
              exP.textContent = `\u201C${def.example}\u201D`;
              contentDiv.appendChild(exP);
            }
            defItem.appendChild(contentDiv);
            defList.appendChild(defItem);
          });
          meaningBlock.appendChild(defList);
        }
        const synonyms = [
          ...meaning.synonyms || [],
          ...meaning.definitions?.flatMap((d) => d.synonyms || []) || []
        ].filter((v, i, a) => typeof v === "string" && v.trim() && a.indexOf(v) === i);
        if (synonyms.length > 0) {
          const synDiv = document.createElement("div");
          synDiv.className = "rc-synonyms-row";
          synDiv.innerHTML = `<span class="rc-synonyms-label">synonyms:</span> <span>${synonyms.slice(0, 6).join(", ")}</span>`;
          meaningBlock.appendChild(synDiv);
        }
        body.appendChild(meaningBlock);
      }
    }
  }
  renderNotFound(body, word) {
    body.innerHTML = `
      <div class="rc-not-found-state">
        <p>No dictionary definition found for "<strong>${word}</strong>".</p>
        <div class="rc-actions-row">
          <a class="rc-link-btn" href="https://www.google.com/search?q=define+${encodeURIComponent(word)}" target="_blank">
            Search Google
          </a>
          <a class="rc-link-btn secondary" href="https://en.wiktionary.org/wiki/${encodeURIComponent(word)}" target="_blank">
            Wiktionary
          </a>
        </div>
      </div>
    `;
  }
  hide() {
    if (this.outsidePointerHandler) {
      document.removeEventListener("mousedown", this.outsidePointerHandler);
      document.removeEventListener("touchstart", this.outsidePointerHandler);
      this.outsidePointerHandler = null;
    }
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
};

// src/translator.ts
var import_obsidian4 = require("obsidian");
var SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "hi", name: "Hindi" },
  { code: "gu", name: "Gujarati" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ru", name: "Russian" },
  { code: "ar", name: "Arabic" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "tr", name: "Turkish" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "id", name: "Indonesian" },
  { code: "vi", name: "Vietnamese" },
  { code: "uk", name: "Ukrainian" },
  { code: "th", name: "Thai" }
];
var TranslatorService = class {
  /**
   * Translate text to target language using either official Google Cloud Translation API (if API key provided)
   * or Google's client endpoint.
   */
  static async translate(text, targetLang = "en", apiKey) {
    const trimmed = text.trim();
    if (!trimmed) {
      return { translatedText: "" };
    }
    if (apiKey && apiKey.trim().length > 0) {
      try {
        const cloudResult = await this.translateWithCloudApi(trimmed, targetLang, apiKey.trim());
        if (cloudResult) return cloudResult;
      } catch (err) {
        console.warn("Reader Companion: Google Cloud API error, falling back to free endpoint", err);
      }
    }
    return this.translateWithFreeEndpoint(trimmed, targetLang);
  }
  static async translateWithCloudApi(text, targetLang, apiKey) {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
    const response = await (0, import_obsidian4.requestUrl)({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        format: "text"
      })
    });
    if (response.status === 200 && response.json?.data?.translations?.[0]) {
      const trans = response.json.data.translations[0];
      return {
        translatedText: trans.translatedText || text,
        detectedSourceLanguage: trans.detectedSourceLanguage
      };
    }
    return null;
  }
  static async translateWithFreeEndpoint(trimmed, targetLang) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(trimmed)}`;
    try {
      const response = await (0, import_obsidian4.requestUrl)({
        url,
        method: "GET"
      });
      if (response.status === 200 && Array.isArray(response.json)) {
        const sentences = response.json[0];
        let translatedText = "";
        if (Array.isArray(sentences)) {
          for (const s of sentences) {
            if (Array.isArray(s) && typeof s[0] === "string") {
              translatedText += s[0];
            }
          }
        }
        const detectedSource = typeof response.json[2] === "string" ? response.json[2] : void 0;
        return {
          translatedText: translatedText || trimmed,
          detectedSourceLanguage: detectedSource
        };
      }
      return { translatedText: trimmed };
    } catch (err) {
      console.warn("Reader Companion: Translation API error", err);
      throw err;
    }
  }
  static getWebUrl(text, targetLang = "en") {
    return `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(targetLang)}&text=${encodeURIComponent(
      text
    )}&op=translate`;
  }
  static speak(text, lang = "en") {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const langCode = lang.split("-")[0];
        const localVoice = voices.find((v) => v.lang.startsWith(langCode) && v.localService) || voices.find((v) => v.lang.startsWith(langCode));
        if (localVoice) {
          utterance.voice = localVoice;
        }
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("SpeechSynthesis error", e);
    }
  }
};

// src/ui/translate-modal.ts
var TranslateModal = class {
  constructor() {
    this.el = null;
    this.currentText = "";
    this.currentTargetLang = "en";
    this.outsidePointerHandler = null;
    this.keydownHandler = null;
  }
  async show(coords, text, defaultTargetLang = "en", apiKey) {
    this.hide();
    this.currentText = text.trim();
    this.currentTargetLang = defaultTargetLang;
    this.apiKey = apiKey;
    if (!this.currentText) return;
    this.el = document.createElement("div");
    this.el.className = "rc-popover rc-translate-popover";
    const header = document.createElement("div");
    header.className = "rc-popover-header";
    const titleWrap = document.createElement("div");
    titleWrap.className = "rc-header-title-wrap";
    titleWrap.innerHTML = `<span class="rc-header-icon">${ICONS.translate}</span>`;
    const selectEl = document.createElement("select");
    selectEl.className = "rc-lang-select";
    for (const lang of SUPPORTED_LANGUAGES) {
      const opt = document.createElement("option");
      opt.value = lang.code;
      opt.textContent = lang.name;
      if (lang.code === this.currentTargetLang) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    }
    selectEl.addEventListener("change", async () => {
      this.currentTargetLang = selectEl.value;
      await this.runTranslation();
    });
    titleWrap.appendChild(selectEl);
    header.appendChild(titleWrap);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "rc-circle-btn";
    closeBtn.title = "Close";
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener("click", () => this.hide());
    header.appendChild(closeBtn);
    this.el.appendChild(header);
    const body = document.createElement("div");
    body.className = "rc-popover-body rc-translate-body";
    this.el.appendChild(body);
    document.body.appendChild(this.el);
    if (window.innerWidth <= 500) {
      this.el.classList.add("centered");
    } else {
      this.position(coords);
    }
    this.el.addEventListener("mousedown", (e) => e.stopPropagation());
    this.el.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    this.el.addEventListener("touchend", (e) => e.stopPropagation());
    this.el.addEventListener("click", (e) => e.stopPropagation());
    setTimeout(() => {
      this.outsidePointerHandler = (e) => {
        const target = e instanceof MouseEvent ? e.target : e.touches?.[0]?.target || e.target;
        if (this.el && target && !this.el.contains(target)) {
          this.hide();
        }
      };
      this.keydownHandler = (e) => {
        if (e.key === "Escape") {
          this.hide();
        }
      };
      document.addEventListener("mousedown", this.outsidePointerHandler);
      document.addEventListener("touchstart", this.outsidePointerHandler, { passive: true });
      document.addEventListener("keydown", this.keydownHandler);
    }, 60);
    await this.runTranslation();
  }
  position(coords) {
    if (!this.el) return;
    const estimatedHeight = 360;
    const rawX = typeof coords.x === "number" && !isNaN(coords.x) && coords.x > 0 ? coords.x : window.innerWidth / 2;
    const rawY = typeof coords.y === "number" && !isNaN(coords.y) && coords.y > 0 ? coords.y : window.innerHeight / 3;
    const bottomY = typeof coords.bottomY === "number" && !isNaN(coords.bottomY) ? coords.bottomY : rawY + 20;
    let posX = Math.max(200, Math.min(window.innerWidth - 200, rawX));
    const isNearBottom = rawY + estimatedHeight > window.innerHeight - 60;
    let topPos;
    let transform;
    if (isNearBottom) {
      topPos = Math.max(20, rawY - 12);
      transform = "translate(-50%, -100%)";
    } else {
      topPos = bottomY + 12;
      transform = "translate(-50%, 0)";
    }
    this.el.style.left = `${posX}px`;
    this.el.style.top = `${topPos}px`;
    this.el.style.transform = transform;
  }
  async runTranslation() {
    if (!this.el) return;
    const body = this.el.querySelector(".rc-translate-body");
    if (!body) return;
    body.innerHTML = `
      <div class="rc-translate-source">
        <label class="rc-label">Selected Text</label>
        <div class="rc-source-box">${this.escapeHtml(this.currentText)}</div>
      </div>
      <div class="rc-translate-target">
        <label class="rc-label">Translation</label>
        <div class="rc-target-box rc-loading">
          <div class="rc-spinner"></div>
          <span>Translating...</span>
        </div>
      </div>
    `;
    try {
      const res = await TranslatorService.translate(this.currentText, this.currentTargetLang, this.apiKey);
      if (!this.el) return;
      const targetBox = body.querySelector(".rc-target-box");
      if (targetBox) {
        targetBox.className = "rc-target-box";
        targetBox.textContent = res.translatedText;
      }
      const existingFooter = body.querySelector(".rc-translate-footer");
      if (existingFooter) existingFooter.remove();
      const footer = document.createElement("div");
      footer.className = "rc-translate-footer";
      const leftActions = document.createElement("div");
      leftActions.className = "rc-footer-left";
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "rc-pill-btn";
      copyBtn.innerHTML = `${ICONS.copy}<span>Copy</span>`;
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(res.translatedText);
        copyBtn.innerHTML = `${ICONS.check}<span>Copied!</span>`;
        setTimeout(() => {
          copyBtn.innerHTML = `${ICONS.copy}<span>Copy</span>`;
        }, 1500);
      });
      leftActions.appendChild(copyBtn);
      const listenBtn = document.createElement("button");
      listenBtn.type = "button";
      listenBtn.className = "rc-pill-btn";
      listenBtn.innerHTML = `${ICONS.volume}<span>Listen</span>`;
      listenBtn.addEventListener("click", () => {
        TranslatorService.speak(res.translatedText, this.currentTargetLang);
      });
      leftActions.appendChild(listenBtn);
      footer.appendChild(leftActions);
      const webLink = document.createElement("a");
      webLink.className = "rc-pill-btn primary";
      webLink.href = TranslatorService.getWebUrl(this.currentText, this.currentTargetLang);
      webLink.target = "_blank";
      webLink.rel = "noreferrer";
      webLink.innerHTML = `<span>Google Translate</span>${ICONS.externalLink}`;
      footer.appendChild(webLink);
      body.appendChild(footer);
    } catch {
      if (!this.el) return;
      const targetBox = body.querySelector(".rc-target-box");
      if (targetBox) {
        targetBox.className = "rc-target-box";
        targetBox.innerHTML = `
          <span class="rc-error-text">Failed to translate. Check your internet connection.</span>
        `;
      }
    }
  }
  escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  hide() {
    if (this.outsidePointerHandler) {
      document.removeEventListener("mousedown", this.outsidePointerHandler);
      document.removeEventListener("touchstart", this.outsidePointerHandler);
      this.outsidePointerHandler = null;
    }
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
};

// src/ui/note-modal.ts
var NoteModal = class {
  constructor() {
    this.el = null;
    this.outsidePointerHandler = null;
    this.keydownHandler = null;
  }
  show(options) {
    this.hide();
    let selectedColor = options.initialColor || HIGHLIGHT_COLORS[0].hex;
    this.el = document.createElement("div");
    this.el.className = "rc-popover rc-note-popover";
    const header = document.createElement("div");
    header.className = "rc-popover-header";
    const title = document.createElement("h3");
    title.className = "rc-popover-title";
    title.textContent = options.isExisting ? "Edit Note" : "Add Note";
    header.appendChild(title);
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "rc-circle-btn";
    closeBtn.title = "Close";
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener("click", () => this.hide());
    header.appendChild(closeBtn);
    this.el.appendChild(header);
    const body = document.createElement("div");
    body.className = "rc-popover-body rc-note-body";
    const quoteBox = document.createElement("div");
    quoteBox.className = "rc-quote-snippet";
    quoteBox.textContent = `\u201C${options.initialText}\u201D`;
    body.appendChild(quoteBox);
    const textareaWrap = document.createElement("div");
    textareaWrap.className = "rc-textarea-wrap";
    const textarea = document.createElement("textarea");
    textarea.className = "rc-note-textarea";
    textarea.placeholder = "Write your note here... (Ctrl+Enter to save)";
    textarea.rows = 3;
    textarea.value = options.initialNote || "";
    textareaWrap.appendChild(textarea);
    body.appendChild(textareaWrap);
    const colorRow = document.createElement("div");
    colorRow.className = "rc-color-row large";
    const colorDots = [];
    for (const color of HIGHLIGHT_COLORS) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "rc-color-dot" + (color.hex.toLowerCase() === selectedColor.toLowerCase() ? " active" : "");
      dot.style.backgroundColor = color.hex;
      dot.title = `Color: ${color.name}`;
      dot.addEventListener("click", () => {
        selectedColor = color.hex;
        colorDots.forEach((d) => d.classList.remove("active"));
        dot.classList.add("active");
      });
      colorDots.push(dot);
      colorRow.appendChild(dot);
    }
    body.appendChild(colorRow);
    const footer = document.createElement("div");
    footer.className = "rc-note-footer";
    const leftCol = document.createElement("div");
    leftCol.className = "rc-footer-left";
    if (options.onViewInPanel) {
      const panelBtn = document.createElement("button");
      panelBtn.type = "button";
      panelBtn.className = "rc-text-btn";
      panelBtn.innerHTML = `${ICONS.bookOpen}<span>View in panel</span>`;
      panelBtn.addEventListener("click", () => {
        this.hide();
        options.onViewInPanel?.();
      });
      leftCol.appendChild(panelBtn);
    }
    if (options.isExisting && options.onDelete) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "rc-text-btn danger";
      deleteBtn.innerHTML = `${ICONS.trash}<span>Delete</span>`;
      deleteBtn.addEventListener("click", () => {
        this.hide();
        options.onDelete?.();
      });
      leftCol.appendChild(deleteBtn);
    }
    footer.appendChild(leftCol);
    const rightCol = document.createElement("div");
    rightCol.className = "rc-footer-right";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "rc-pill-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => this.hide());
    rightCol.appendChild(cancelBtn);
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "rc-pill-btn primary";
    saveBtn.textContent = "Save";
    const doSave = () => {
      this.hide();
      options.onSave(textarea.value, selectedColor);
    };
    saveBtn.addEventListener("click", doSave);
    rightCol.appendChild(saveBtn);
    footer.appendChild(rightCol);
    body.appendChild(footer);
    this.el.appendChild(body);
    document.body.appendChild(this.el);
    if (window.innerWidth <= 500) {
      this.el.classList.add("centered");
    } else if (options.coords) {
      this.position(options.coords);
    } else {
      this.el.classList.add("centered");
    }
    textarea.focus();
    this.el.addEventListener("mousedown", (e) => e.stopPropagation());
    this.el.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    this.el.addEventListener("touchend", (e) => e.stopPropagation());
    this.el.addEventListener("click", (e) => e.stopPropagation());
    setTimeout(() => {
      this.outsidePointerHandler = (e) => {
        const target = e instanceof MouseEvent ? e.target : e.touches?.[0]?.target || e.target;
        if (this.el && target && !this.el.contains(target)) {
          this.hide();
        }
      };
      this.keydownHandler = (e) => {
        if (e.key === "Escape") {
          this.hide();
        } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          doSave();
        }
      };
      document.addEventListener("mousedown", this.outsidePointerHandler);
      document.addEventListener("touchstart", this.outsidePointerHandler, { passive: true });
      document.addEventListener("keydown", this.keydownHandler);
    }, 60);
  }
  position(coords) {
    if (!this.el) return;
    const estimatedHeight = 320;
    const rawX = typeof coords.x === "number" && !isNaN(coords.x) && coords.x > 0 ? coords.x : window.innerWidth / 2;
    const rawY = typeof coords.y === "number" && !isNaN(coords.y) && coords.y > 0 ? coords.y : window.innerHeight / 3;
    const bottomY = typeof coords.bottomY === "number" && !isNaN(coords.bottomY) ? coords.bottomY : rawY + 20;
    let posX = Math.max(190, Math.min(window.innerWidth - 190, rawX));
    const isNearBottom = rawY + estimatedHeight > window.innerHeight - 60;
    let topPos;
    let transform;
    if (isNearBottom) {
      topPos = Math.max(20, rawY - 12);
      transform = "translate(-50%, -100%)";
    } else {
      topPos = bottomY + 12;
      transform = "translate(-50%, 0)";
    }
    this.el.style.left = `${posX}px`;
    this.el.style.top = `${topPos}px`;
    this.el.style.transform = transform;
  }
  hide() {
    if (this.outsidePointerHandler) {
      document.removeEventListener("mousedown", this.outsidePointerHandler);
      document.removeEventListener("touchstart", this.outsidePointerHandler);
      this.outsidePointerHandler = null;
    }
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
};

// src/ui/annotations-view.ts
var import_obsidian5 = require("obsidian");
var VIEW_TYPE_READER_COMPANION = "reader-companion-annotations-view";
var ReaderCompanionView = class extends import_obsidian5.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.filterColor = null;
    this.searchQuery = "";
    this.showAllFiles = false;
    this.onDataChanged = () => {
      this.render();
    };
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE_READER_COMPANION;
  }
  getDisplayText() {
    return "Annotations & Notes";
  }
  getIcon() {
    return "highlighter";
  }
  async onOpen() {
    this.plugin.storage.on("changed", this.onDataChanged);
    this.registerEvent(this.app.workspace.on("file-open", () => this.render()));
    this.render();
  }
  async onClose() {
    this.plugin.storage.off("changed", this.onDataChanged);
  }
  render() {
    const container = this.containerEl.children[1];
    if (!container) return;
    container.empty();
    container.addClass("rc-annotations-sidebar");
    const activeFile = this.app.workspace.getActiveFile();
    const activeFilePath = activeFile?.path || "";
    const header = container.createDiv({ cls: "rc-sidebar-header" });
    const titleRow = header.createDiv({ cls: "rc-sidebar-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "rc-sidebar-title-left" });
    const titleEl = titleLeft.createEl("h4", { cls: "rc-sidebar-title" });
    titleEl.setText(this.showAllFiles ? "All Annotations" : activeFile?.basename || "No Active Note");
    const countBadge = titleLeft.createSpan({ cls: "rc-badge" });
    const headerActions = titleRow.createDiv({ cls: "rc-sidebar-actions" });
    const scopeBtn = headerActions.createEl("button", {
      cls: "rc-sidebar-icon-btn",
      attr: { title: this.showAllFiles ? "Show only active note" : "Show all vault notes" }
    });
    scopeBtn.innerHTML = ICONS.bookOpen;
    if (this.showAllFiles) scopeBtn.addClass("active");
    scopeBtn.addEventListener("click", () => {
      this.showAllFiles = !this.showAllFiles;
      this.render();
    });
    const exportBtn = headerActions.createEl("button", {
      cls: "rc-sidebar-icon-btn",
      attr: { title: "Export annotations as markdown" }
    });
    exportBtn.innerHTML = ICONS.download;
    exportBtn.addEventListener("click", () => this.exportAnnotations());
    const searchRow = header.createDiv({ cls: "rc-search-row" });
    const searchInput = searchRow.createEl("input", {
      cls: "rc-search-input",
      type: "text",
      placeholder: "Search highlights & notes..."
    });
    searchInput.value = this.searchQuery;
    const clearBtn = searchRow.createEl("button", {
      cls: `rc-search-clear-btn ${this.searchQuery ? "visible" : ""}`,
      attr: { title: "Clear search" }
    });
    clearBtn.innerHTML = ICONS.close;
    clearBtn.addEventListener("click", () => {
      this.searchQuery = "";
      searchInput.value = "";
      clearBtn.removeClass("visible");
      searchInput.focus();
      this.renderList(listContainer, activeFilePath, countBadge);
    });
    searchInput.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      if (this.searchQuery) {
        clearBtn.addClass("visible");
      } else {
        clearBtn.removeClass("visible");
      }
      this.renderList(listContainer, activeFilePath, countBadge);
    });
    const filterRow = header.createDiv({ cls: "rc-color-filter-row" });
    const allChip = filterRow.createEl("button", {
      cls: `rc-filter-chip ${this.filterColor === null ? "active" : ""}`,
      text: "All"
    });
    allChip.addEventListener("click", () => {
      this.filterColor = null;
      this.render();
    });
    for (const color of HIGHLIGHT_COLORS) {
      const chip = filterRow.createEl("button", {
        cls: `rc-filter-chip ${this.filterColor === color.hex ? "active" : ""}`,
        attr: { title: color.name }
      });
      const dot = chip.createSpan({ cls: "rc-chip-dot" });
      dot.style.backgroundColor = color.hex;
      chip.createSpan({ text: color.name });
      chip.addEventListener("click", () => {
        this.filterColor = this.filterColor === color.hex ? null : color.hex;
        this.render();
      });
    }
    const listContainer = container.createDiv({ cls: "rc-annotations-list" });
    this.renderList(listContainer, activeFilePath, countBadge);
  }
  renderList(listContainer, activeFilePath, countBadge) {
    listContainer.empty();
    let items = this.showAllFiles ? this.plugin.storage.getAllAnnotations() : this.plugin.storage.getAnnotationsForFile(activeFilePath);
    if (this.filterColor) {
      items = items.filter((item) => item.color.toLowerCase() === this.filterColor?.toLowerCase());
    }
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      items = items.filter(
        (item) => item.text.toLowerCase().includes(query) || item.note && item.note.toLowerCase().includes(query) || item.fileTitle.toLowerCase().includes(query)
      );
    }
    if (countBadge) {
      countBadge.setText(items.length.toString());
    }
    if (items.length === 0) {
      const emptyState = listContainer.createDiv({ cls: "rc-empty-state" });
      emptyState.createDiv({ cls: "rc-empty-icon" }).innerHTML = ICONS.highlighter;
      emptyState.createEl("p", {
        text: this.showAllFiles ? "No highlights or notes recorded yet." : "No annotations in this note yet. Select text in reading mode to highlight or add notes!"
      });
      return;
    }
    for (const item of items) {
      this.renderAnnotationCard(listContainer, item);
    }
  }
  renderAnnotationCard(container, item) {
    const card = container.createDiv({ cls: "rc-annotation-card" });
    card.dataset.id = item.id;
    card.style.borderLeftColor = item.color;
    const topRow = card.createDiv({ cls: "rc-card-top-row" });
    const infoCol = topRow.createDiv({ cls: "rc-card-info" });
    const fileLink = infoCol.createSpan({ cls: "rc-card-file-link" });
    fileLink.setText(item.fileTitle);
    fileLink.title = "Source note: " + item.fileTitle;
    fileLink.addEventListener("click", async () => {
      const file = await this.plugin.storage.resolveFile(item.filePath, item.fileTitle, item.text);
      if (file) {
        let leaf = this.app.workspace.getLeavesOfType("markdown").find(
          (l) => l.view?.file?.path === file.path
        );
        if (!leaf) {
          leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(file);
        }
        this.app.workspace.setActiveLeaf(leaf, { focus: true });
      } else {
        new import_obsidian5.Notice(`Note "${item.fileTitle}" was not found in the vault.`);
      }
    });
    const menuBtn = topRow.createEl("button", {
      cls: "rc-card-action-btn rc-more-btn",
      attr: { title: "Options" }
    });
    menuBtn.innerHTML = ICONS.moreVertical;
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = new import_obsidian5.Menu();
      menu.addItem((itemMenu) => {
        itemMenu.setTitle("Copy text").setIcon("copy").onClick(() => {
          navigator.clipboard.writeText(item.text);
          new import_obsidian5.Notice("Copied text to clipboard!");
        });
      });
      menu.addItem((itemMenu) => {
        itemMenu.setTitle(item.note ? "Edit note" : "Add note").setIcon("edit").onClick(() => {
          this.plugin.openNoteModal({
            initialText: item.text,
            initialNote: item.note,
            initialColor: item.color,
            isExisting: true,
            onSave: async (newNote, newColor) => {
              await this.plugin.storage.updateAnnotation(item.id, {
                note: newNote,
                color: newColor
              });
            },
            onDelete: async () => {
              await this.plugin.storage.deleteAnnotation(item.id);
            }
          });
        });
      });
      menu.addSeparator();
      menu.addItem((itemMenu) => {
        itemMenu.setTitle("Delete").setIcon("trash").setWarning(true).onClick(async () => {
          await this.plugin.storage.deleteAnnotation(item.id);
          new import_obsidian5.Notice("Deleted highlight.");
        });
      });
      menu.showAtMouseEvent(e);
    });
    const quoteEl = card.createDiv({ cls: "rc-card-quote" });
    quoteEl.style.backgroundColor = `color-mix(in srgb, ${item.color} 15%, transparent)`;
    quoteEl.setText(item.text);
    quoteEl.title = "Click to jump to text in document";
    quoteEl.addEventListener("click", () => {
      this.jumpToText(item.filePath, item.text, item.id);
    });
    if (item.note) {
      const noteEl = card.createDiv({ cls: "rc-card-note" });
      noteEl.setText(item.note);
      noteEl.title = "Click to edit note (or jump to text)";
      noteEl.addEventListener("click", () => {
        this.plugin.openNoteModal({
          initialText: item.text,
          initialNote: item.note,
          initialColor: item.color,
          isExisting: true,
          onSave: async (newNote, newColor) => {
            await this.plugin.storage.updateAnnotation(item.id, {
              note: newNote,
              color: newColor
            });
          },
          onDelete: async () => {
            await this.plugin.storage.deleteAnnotation(item.id);
          }
        });
      });
    } else {
      const addNoteBtn = card.createEl("button", { cls: "rc-card-add-note-btn" });
      addNoteBtn.innerHTML = `${ICONS.plus}<span>Add note</span>`;
      addNoteBtn.addEventListener("click", () => {
        this.plugin.openNoteModal({
          initialText: item.text,
          initialColor: item.color,
          isExisting: true,
          onSave: async (newNote, newColor) => {
            await this.plugin.storage.updateAnnotation(item.id, {
              note: newNote,
              color: newColor
            });
          }
        });
      });
    }
    const cardFooter = card.createDiv({ cls: "rc-card-footer" });
    const dateSpan = cardFooter.createSpan({ cls: "rc-card-date-bottom" });
    dateSpan.setText(this.formatDate(item.createdAt));
  }
  async jumpToText(filePath, text, annotationId) {
    const file = await this.plugin.storage.resolveFile(filePath, void 0, text);
    if (!file) {
      new import_obsidian5.Notice("Could not locate the note for this highlight in the vault.");
      return;
    }
    filePath = file.path;
    let targetLeaf = this.app.workspace.getLeavesOfType("markdown").find(
      (l) => l.view?.file?.path === filePath
    );
    if (!targetLeaf) {
      targetLeaf = this.app.workspace.getLeaf(false);
      await targetLeaf.openFile(file);
    }
    this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
    let lineNumber = -1;
    try {
      const fileContent = await this.app.vault.cachedRead(file);
      const cleanTarget = text.trim();
      let index = fileContent.indexOf(cleanTarget);
      if (index === -1 && cleanTarget.length > 25) {
        index = fileContent.indexOf(cleanTarget.slice(0, 25));
      }
      if (index === -1) {
        const normFile = fileContent.replace(/\s+/g, " ");
        const normTarget = cleanTarget.replace(/\s+/g, " ");
        index = normFile.indexOf(normTarget);
      }
      if (index !== -1) {
        lineNumber = fileContent.substring(0, index).split("\n").length - 1;
      }
    } catch (err) {
      console.warn("Reader Companion: Error reading file for jumpToText", err);
    }
    if (lineNumber !== -1) {
      try {
        targetLeaf.setEphemeralState({ line: lineNumber, focus: true });
        const view = targetLeaf.view;
        if (view?.previewMode && typeof view.previewMode.applyScroll === "function") {
          view.previewMode.applyScroll(lineNumber);
        } else if (view?.currentMode && typeof view.currentMode.applyScroll === "function") {
          view.currentMode.applyScroll(lineNumber);
        }
        if (view?.editor) {
          const pos = { line: lineNumber, ch: 0 };
          view.editor.scrollIntoView({ from: pos, to: pos }, true);
          view.editor.setCursor(pos);
        }
      } catch {
      }
    }
    this.plugin.reapplyHighlightsForFile(filePath);
    const tryScroll = () => {
      const view = targetLeaf?.view;
      if (!view) return false;
      if (annotationId) {
        const mark = view.containerEl.querySelector(`mark[data-rc-id="${annotationId}"]`);
        if (mark && mark instanceof HTMLElement) {
          mark.scrollIntoView({ behavior: "smooth", block: "center" });
          mark.addClass("rc-pulse-highlight");
          setTimeout(() => mark.removeClass("rc-pulse-highlight"), 2e3);
          return true;
        }
      }
      const previewContainer = view.previewMode?.containerEl || view.containerEl;
      const cleanSnippet = text.trim().slice(0, 35);
      const walker = document.createTreeWalker(previewContainer, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent && node.textContent.includes(cleanSnippet)) {
          const el = node.parentElement;
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.addClass("rc-pulse-highlight");
            setTimeout(() => el.removeClass("rc-pulse-highlight"), 2e3);
            return true;
          }
        }
      }
      return false;
    };
    setTimeout(() => {
      this.plugin.reapplyHighlightsForFile(filePath);
      if (!tryScroll()) {
        setTimeout(() => {
          this.plugin.reapplyHighlightsForFile(filePath);
          if (!tryScroll()) {
            setTimeout(tryScroll, 300);
          }
        }, 150);
      }
    }, 60);
  }
  async exportAnnotations() {
    const activeFile = this.app.workspace.getActiveFile();
    const items = this.showAllFiles ? this.plugin.storage.getAllAnnotations() : activeFile ? this.plugin.storage.getAnnotationsForFile(activeFile.path) : [];
    if (items.length === 0) return;
    let md = `# Reading Notes & Highlights

`;
    if (!this.showAllFiles && activeFile) {
      md += `*Source Note: [[${activeFile.basename}]]*

`;
    }
    for (const item of items) {
      md += `> ${item.text}

`;
      if (item.note) {
        md += `**Note:** ${item.note}

`;
      }
      if (this.showAllFiles) {
        md += `*File: [[${item.fileTitle}]] \u2014 ${this.formatDate(item.createdAt)}*

`;
      }
      md += `---

`;
    }
    await navigator.clipboard.writeText(md);
    alert("Copied annotations to clipboard as Markdown!");
  }
  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString(void 0, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
};

// src/settings.ts
var import_obsidian6 = require("obsidian");
var ReaderCompanionSettingTab = class extends import_obsidian6.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Reader Companion Settings" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Customize popup triggers, translation target language, colors, and UI theme."
    });
    new import_obsidian6.Setting(containerEl).setName("Default Highlight Color").setDesc("The default color chosen for quick highlighting.").addDropdown((drop) => {
      for (const col of HIGHLIGHT_COLORS) {
        drop.addOption(col.hex, col.name);
      }
      drop.setValue(this.plugin.settings.defaultColor);
      drop.onChange(async (val) => {
        this.plugin.settings.defaultColor = val;
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Default Translation Language").setDesc("Target language used by the instant translator.").addDropdown((drop) => {
      for (const lang of SUPPORTED_LANGUAGES) {
        drop.addOption(lang.code, lang.name);
      }
      drop.setValue(this.plugin.settings.targetLanguage);
      drop.onChange(async (val) => {
        this.plugin.settings.targetLanguage = val;
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Google Cloud Translation API Key (Optional)").setDesc("If provided, your official Google Cloud Translation API will be used instead of the default free endpoint.").addText((text) => {
      text.setPlaceholder("Enter your API key...").setValue(this.plugin.settings.googleApiKey || "").onChange(async (val) => {
        this.plugin.settings.googleApiKey = val.trim();
        await this.plugin.savePluginData();
      });
      text.inputEl.type = "password";
    });
    new import_obsidian6.Setting(containerEl).setName("Enable in Reading View").setDesc("Show selection popup menu when text is selected in Reading Mode.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.enableInReadingMode);
      toggle.onChange(async (val) => {
        this.plugin.settings.enableInReadingMode = val;
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Enable in Editing / Live Preview Mode").setDesc("Show selection popup menu when text is selected in editing mode.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.enableInEditingMode);
      toggle.onChange(async (val) => {
        this.plugin.settings.enableInEditingMode = val;
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Popup UI Theme").setDesc("Choose theme styling for the popup menus and modals.").addDropdown((drop) => {
      drop.addOption("auto", "Auto (Match Obsidian)");
      drop.addOption("dark", "Dark");
      drop.addOption("light", "Light");
      drop.addOption("sepia", "Sepia (Warm Book Theme)");
      drop.setValue(this.plugin.settings.uiTheme);
      drop.onChange(async (val) => {
        this.plugin.settings.uiTheme = val;
        this.plugin.updateThemeClass();
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Auto-pronounce on Definition").setDesc("Automatically play audio pronunciation when opening a definition popup.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.autoPronounce);
      toggle.onChange(async (val) => {
        this.plugin.settings.autoPronounce = val;
        await this.plugin.savePluginData();
      });
    });
    containerEl.createEl("h3", { text: "Vocabulary Tracking" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Save looked-up words, definitions, and sentence context into a dedicated file formatted for vocabulary tracking and flashcards (compatible with Goodreads Bookshelf)."
    });
    new import_obsidian6.Setting(containerEl).setName("Enable Vocabulary Tracking").setDesc("Enable vocabulary collection and saving.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.enableVocabulary !== false);
      toggle.onChange(async (val) => {
        this.plugin.settings.enableVocabulary = val;
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Auto-Save on Define").setDesc(
      "Automatically save the word, definition, and sentence context to your vocabulary file whenever you click 'Define' (Kindle style). When disabled, an 'Add to vocabulary' option is displayed in the selection menu and definition popup."
    ).addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.autoSaveVocabulary !== false);
      toggle.onChange(async (val) => {
        this.plugin.settings.autoSaveVocabulary = val;
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Vocabulary File Path").setDesc("Vault path to the markdown file where vocabulary entries are appended.").addText((text) => {
      text.setPlaceholder("Vocabulary.md").setValue(this.plugin.settings.vocabularyFilePath || "Vocabulary.md").onChange(async (val) => {
        this.plugin.settings.vocabularyFilePath = val.trim() || "Vocabulary.md";
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Vocabulary Heading Level").setDesc("Heading level used for each word in the vocabulary file.").addDropdown((drop) => {
      drop.addOption("h2", "H2 (##)");
      drop.addOption("h3", "H3 (###) \u2014 Default");
      drop.addOption("h4", "H4 (####)");
      drop.setValue(this.plugin.settings.vocabularyHeadingLevel || "h3");
      drop.onChange(async (val) => {
        this.plugin.settings.vocabularyHeadingLevel = val;
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Add Frontmatter Property to Vocabulary").setDesc("Include a frontmatter property in the vocabulary file (e.g. type: vocabulary) so flashcards or queries can find all vocabulary.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.addVocabularyProperty !== false);
      toggle.onChange(async (val) => {
        this.plugin.settings.addVocabularyProperty = val;
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Vocabulary Property Key").setDesc("YAML frontmatter key name for identifying the vocabulary file.").addText((text) => {
      text.setPlaceholder("type").setValue(this.plugin.settings.vocabularyPropertyKey || "type").onChange(async (val) => {
        this.plugin.settings.vocabularyPropertyKey = val.trim() || "type";
        await this.plugin.savePluginData();
      });
    });
    new import_obsidian6.Setting(containerEl).setName("Vocabulary Property Value").setDesc("YAML frontmatter value for identifying the vocabulary file.").addText((text) => {
      text.setPlaceholder("vocabulary").setValue(this.plugin.settings.vocabularyPropertyValue || "vocabulary").onChange(async (val) => {
        this.plugin.settings.vocabularyPropertyValue = val.trim() || "vocabulary";
        await this.plugin.savePluginData();
      });
    });
    containerEl.createEl("h3", { text: "Data & Storage Persistence" });
    new import_obsidian6.Setting(containerEl).setName("Vault Storage (.reader-companion/annotations.json)").setDesc(
      "All highlights and notes are safely saved in your vault root (.reader-companion/annotations.json). Your data survives plugin uninstalls and syncs across devices via Obsidian Sync, Git, or iCloud."
    ).addButton((btn) => {
      btn.setButtonText("Reload from Vault");
      btn.setTooltip("Re-read annotations from .reader-companion/annotations.json");
      btn.onClick(async () => {
        await this.plugin.reloadVaultAnnotations();
        new import_obsidian6.Notice("Annotations reloaded from vault storage!");
      });
    });
  }
};

// src/vocabulary.ts
var import_obsidian7 = require("obsidian");
var VocabularyService = class {
  constructor(plugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }
  getHeadingPrefix(level) {
    switch (level) {
      case "h1":
        return "#";
      case "h2":
        return "##";
      case "h4":
        return "####";
      case "h3":
      default:
        return "###";
    }
  }
  async isWordSaved(rawWord) {
    const cleanWord = rawWord.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!cleanWord) return false;
    const filePath = (0, import_obsidian7.normalizePath)(this.plugin.settings.vocabularyFilePath || "Vocabulary.md");
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof import_obsidian7.TFile)) {
      return false;
    }
    try {
      const content = await this.app.vault.read(file);
      const escapedWord = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordRegex = new RegExp(`^#{1,6}\\s+${escapedWord}\\s*$`, "im");
      return wordRegex.test(content);
    } catch {
      return false;
    }
  }
  async saveWord(options) {
    const { word, contextSentence, sourceTitle, sourcePath, silent } = options;
    const cleanWord = word.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!cleanWord) {
      return { success: false, alreadyExists: false };
    }
    const file = await this.ensureVocabularyFile();
    if (!file) {
      if (!silent) new import_obsidian7.Notice("Reader Companion: Could not access vocabulary file.");
      return { success: false, alreadyExists: false };
    }
    const content = await this.app.vault.read(file);
    const escapedWord = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordRegex = new RegExp(`^#{1,6}\\s+${escapedWord}\\s*$`, "im");
    if (wordRegex.test(content)) {
      if (!silent) {
        new import_obsidian7.Notice(`"${cleanWord}" is already in your vocabulary.`);
      }
      return { success: false, alreadyExists: true };
    }
    await this.ensureFrontmatterProperty(file);
    let defResult = options.definitionResult;
    if (!defResult) {
      try {
        defResult = await DictionaryService.lookup(cleanWord);
      } catch {
      }
    }
    const entryMarkdown = this.formatWordEntry(cleanWord, defResult, contextSentence, sourceTitle, sourcePath);
    const currentContent = await this.app.vault.read(file);
    const trimmed = currentContent.trimEnd();
    const separator = trimmed ? "\n\n" : "";
    const newContent = `${trimmed}${separator}${entryMarkdown}
`;
    await this.app.vault.modify(file, newContent);
    if (!silent) {
      new import_obsidian7.Notice(`Saved "${cleanWord}" to Vocabulary!`);
    }
    return { success: true, alreadyExists: false };
  }
  formatWordEntry(cleanWord, defResult, contextSentence, sourceTitle, sourcePath) {
    const h = this.getHeadingPrefix(this.plugin.settings.vocabularyHeadingLevel || "h3");
    const capitalizedWord = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1);
    const lines = [`${h} ${capitalizedWord}`];
    if (defResult?.meanings && defResult.meanings.length > 0) {
      const inflectionPrefix = defResult.inflectionNote ? ` *(${defResult.inflectionNote})*` : "";
      lines.push(`- **Definition**:${inflectionPrefix}`);
      for (const m of defResult.meanings) {
        const posName = m.partOfSpeech ? m.partOfSpeech.charAt(0).toUpperCase() + m.partOfSpeech.slice(1) : "General";
        lines.push(`  - **${posName}**:`);
        (m.definitions || []).forEach((d, idx) => {
          lines.push(`    ${idx + 1}. ${d.definition.trim()}`);
          if (d.example && d.example.trim()) {
            lines.push(`       - *e.g.* \u201C${d.example.trim().replace(/^["“]+|["”]+$/g, "")}\u201D`);
          }
        });
      }
    } else {
      lines.push(`- **Definition**: No definition found.`);
    }
    lines.push(
      `- **Source Context**: "${contextSentence ? contextSentence.trim().replace(/^["“]+|["”]+$/g, "") : ""}"`
    );
    lines.push(`- **My Examples**:`);
    lines.push(`  1. `);
    if (sourceTitle) {
      lines.push(`- **Source**: [[${sourceTitle}]]`);
    }
    return lines.join("\n");
  }
  async ensureVocabularyFile() {
    const rawPath = this.plugin.settings.vocabularyFilePath || "Vocabulary.md";
    const filePath = (0, import_obsidian7.normalizePath)(rawPath);
    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof import_obsidian7.TFile) {
      return existing;
    }
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash > 0) {
      const folderPath = filePath.substring(0, lastSlash);
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await this.app.vault.createFolder(folderPath);
      }
    }
    const initialLines = [];
    if (this.plugin.settings.addVocabularyProperty) {
      const key = (this.plugin.settings.vocabularyPropertyKey || "type").trim();
      const val = (this.plugin.settings.vocabularyPropertyValue || "vocabulary").trim();
      initialLines.push("---");
      if (key) {
        initialLines.push(`${key}: ${val}`);
      }
      initialLines.push("tags:", "  - book/vocabulary", "---", "");
    }
    return await this.app.vault.create(filePath, initialLines.join("\n"));
  }
  async ensureFrontmatterProperty(file) {
    if (!this.plugin.settings.addVocabularyProperty) return;
    const key = (this.plugin.settings.vocabularyPropertyKey || "type").trim();
    const val = (this.plugin.settings.vocabularyPropertyValue || "vocabulary").trim();
    if (!key) return;
    try {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (!frontmatter[key]) {
          frontmatter[key] = val;
        }
      });
    } catch (e) {
      console.warn("Reader Companion: Could not update frontmatter property", e);
    }
  }
};

// src/main.ts
var ReaderCompanionPlugin = class extends import_obsidian8.Plugin {
  constructor() {
    super(...arguments);
    this.data = {
      version: 1,
      settings: { ...DEFAULT_SETTINGS },
      annotations: {}
    };
    this.settings = { ...DEFAULT_SETTINGS };
    this.isMouseSelecting = false;
    this.isTouchSelecting = false;
    this.selectionDebounceTimer = null;
    this.lastTouchCoords = null;
    this.VAULT_STORAGE_DIR = ".reader-companion";
    this.VAULT_STORAGE_FILE = ".reader-companion/annotations.json";
  }
  async onload() {
    await this.loadPluginData();
    this.storage = new StorageManager(this);
    this.highlighter = new DomHighlighter(this);
    this.vocabulary = new VocabularyService(this);
    this.definitionModal = new DefinitionModal();
    this.translateModal = new TranslateModal();
    this.noteModal = new NoteModal();
    this.selectionMenu = new SelectionMenu({
      onAddNote: (text, coords, existing) => this.handleAddNote(text, coords, existing),
      onCopy: (text) => this.handleCopy(text),
      onTranslate: (text, coords) => this.handleTranslate(text, coords),
      onDefine: (word, coords) => this.handleDefine(word, coords),
      onAddToVocabulary: (word, coords) => this.handleAddToVocabulary(word, coords),
      shouldShowAddToVocabulary: () => this.settings.enableVocabulary && !this.settings.autoSaveVocabulary,
      onSearchVault: (text) => this.handleSearchVault(text),
      onHighlight: (text, color, existingId) => this.handleQuickHighlight(text, color, existingId),
      onDeleteHighlight: async (id) => {
        const activeFile = this.app.workspace.getActiveFile();
        await this.storage.deleteAnnotation(id);
        if (activeFile) this.reapplyHighlightsForFile(activeFile.path);
        new import_obsidian8.Notice("Highlight removed.");
      },
      onClose: () => {
      }
    });
    this.registerView(
      VIEW_TYPE_READER_COMPANION,
      (leaf) => new ReaderCompanionView(leaf, this)
    );
    this.addRibbonIcon("highlighter", "Reader Companion: Annotations", () => {
      this.activateView();
    });
    this.addSettingTab(new ReaderCompanionSettingTab(this.app, this));
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (ctx.sourcePath) {
        this.highlighter.applyHighlights(el, ctx.sourcePath);
      }
    });
    this.storage.on("changed", (...data) => {
      const filePath = typeof data[0] === "string" ? data[0] : "";
      if (filePath) {
        this.reapplyHighlightsForFile(filePath);
      }
    });
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        const newTitle = file instanceof import_obsidian8.TFile ? file.basename : void 0;
        const changed = await this.storage.handleRename(oldPath, file.path, newTitle);
        if (changed) {
          this.reapplyHighlightsForFile(file.path);
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        if (file) {
          if (!this.storage.hasAnnotationsForFile(file.path)) {
            await this.storage.checkAndHealForFile(file);
          }
          setTimeout(() => {
            this.reapplyHighlightsForFile(file.path);
          }, 80);
        }
      })
    );
    this.app.workspace.onLayoutReady(() => {
      this.storage.reconcileAnnotations();
    });
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          this.reapplyHighlightsForFile(activeFile.path);
        }
      })
    );
    this.registerDomEvents();
    this.addCommand({
      id: "open-annotations-panel",
      name: "Open Annotations & Highlights Sidebar",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "show-selection-menu",
      name: "Show Reader Companion Menu for Selection",
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(import_obsidian8.MarkdownView);
        if (!activeView) return;
        const selection = window.getSelection();
        let text = selection?.toString().trim();
        if (!text && activeView.getMode() === "source") {
          try {
            text = activeView.editor.getSelection().trim();
          } catch {
          }
        }
        if (text && text.length >= this.settings.minSelectionLength) {
          const coords = this.getSelectionCoordinates();
          this.handleSelectionEvent();
        } else {
          new import_obsidian8.Notice("Please select text first.");
        }
      }
    });
    this.addCommand({
      id: "define-selected-word",
      name: "Define Selected Word",
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(import_obsidian8.MarkdownView);
        let selection = window.getSelection()?.toString().trim();
        if (!selection && activeView && activeView.getMode() === "source") {
          try {
            selection = activeView.editor.getSelection().trim();
          } catch {
          }
        }
        if (selection) {
          const coords = this.getSelectionCoordinates();
          this.handleDefine(selection, coords);
        } else {
          new import_obsidian8.Notice("Please select a word to define.");
        }
      }
    });
    this.addCommand({
      id: "add-selected-word-to-vocabulary",
      name: "Add Selected Word to Vocabulary",
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(import_obsidian8.MarkdownView);
        let selection = window.getSelection()?.toString().trim();
        if (!selection && activeView && activeView.getMode() === "source") {
          try {
            selection = activeView.editor.getSelection().trim();
          } catch {
          }
        }
        if (selection) {
          const coords = this.getSelectionCoordinates();
          this.handleAddToVocabulary(selection, coords);
        } else {
          new import_obsidian8.Notice("Please select a word to add to vocabulary.");
        }
      }
    });
    this.addCommand({
      id: "translate-selected-text",
      name: "Translate Selected Text",
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(import_obsidian8.MarkdownView);
        let selection = window.getSelection()?.toString().trim();
        if (!selection && activeView && activeView.getMode() === "source") {
          try {
            selection = activeView.editor.getSelection().trim();
          } catch {
          }
        }
        if (selection) {
          const coords = this.getSelectionCoordinates();
          this.translateModal.show(coords, selection, this.settings.targetLanguage);
        } else {
          new import_obsidian8.Notice("Please select text to translate.");
        }
      }
    });
    this.addCommand({
      id: "reload-annotations",
      name: "Reload Annotations from Vault (.reader-companion)",
      callback: async () => {
        await this.reloadVaultAnnotations();
        new import_obsidian8.Notice("Annotations reloaded from vault storage!");
      }
    });
    this.addCommand({
      id: "reconcile-annotations",
      name: "Reconcile moved / renamed notes (Auto-heal)",
      callback: async () => {
        const healed = await this.storage.reconcileAnnotations();
        if (healed > 0) {
          new import_obsidian8.Notice(`Reader Companion: Reconciled ${healed} note(s)!`);
        } else {
          new import_obsidian8.Notice("Reader Companion: All annotation locations are up to date.");
        }
      }
    });
    this.updateThemeClass();
  }
  onunload() {
    if (this.selectionDebounceTimer !== null) {
      window.clearTimeout(this.selectionDebounceTimer);
      this.selectionDebounceTimer = null;
    }
    this.selectionMenu.hide();
    this.definitionModal.hide();
    this.translateModal.hide();
    this.noteModal.hide();
    document.body.removeClass("rc-theme-dark", "rc-theme-light", "rc-theme-sepia");
  }
  async loadPluginData() {
    const loaded = await this.loadData();
    if (loaded) {
      this.data = Object.assign(
        {
          version: 1,
          settings: { ...DEFAULT_SETTINGS },
          annotations: {}
        },
        loaded
      );
      this.data.settings = Object.assign({ ...DEFAULT_SETTINGS }, loaded.settings || {});
      if (!this.data.annotations) {
        this.data.annotations = {};
      }
    }
    this.settings = this.data.settings;
    try {
      if (await this.app.vault.adapter.exists(this.VAULT_STORAGE_FILE)) {
        const content = await this.app.vault.adapter.read(this.VAULT_STORAGE_FILE);
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          this.data.annotations = parsed;
        }
      } else if (Object.keys(this.data.annotations).length > 0) {
        if (!await this.app.vault.adapter.exists(this.VAULT_STORAGE_DIR)) {
          await this.app.vault.adapter.mkdir(this.VAULT_STORAGE_DIR);
        }
        await this.app.vault.adapter.write(
          this.VAULT_STORAGE_FILE,
          JSON.stringify(this.data.annotations, null, 2)
        );
      }
    } catch (err) {
      console.error("[Reader Companion] Error loading vault annotations:", err);
    }
  }
  async savePluginData() {
    this.data.settings = this.settings;
    await this.saveData(this.data);
    try {
      if (!await this.app.vault.adapter.exists(this.VAULT_STORAGE_DIR)) {
        await this.app.vault.adapter.mkdir(this.VAULT_STORAGE_DIR);
      }
      await this.app.vault.adapter.write(
        this.VAULT_STORAGE_FILE,
        JSON.stringify(this.data.annotations, null, 2)
      );
    } catch (err) {
      console.error("[Reader Companion] Error saving vault annotations:", err);
    }
  }
  async reloadVaultAnnotations() {
    try {
      if (await this.app.vault.adapter.exists(this.VAULT_STORAGE_FILE)) {
        const content = await this.app.vault.adapter.read(this.VAULT_STORAGE_FILE);
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          this.data.annotations = parsed;
          const activeFile = this.app.workspace.getActiveFile();
          if (activeFile) {
            this.reapplyHighlightsForFile(activeFile.path);
          }
          this.storage.trigger("changed", activeFile?.path || "");
        }
      }
    } catch (err) {
      console.error("[Reader Companion] Error reloading vault annotations:", err);
    }
  }
  updateThemeClass() {
    document.body.removeClass("rc-theme-dark", "rc-theme-light", "rc-theme-sepia");
    if (this.settings.uiTheme !== "auto") {
      document.body.addClass(`rc-theme-${this.settings.uiTheme}`);
    }
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_READER_COMPANION);
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_READER_COMPANION,
          active: true
        });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
  registerDomEvents() {
    this.registerDomEvent(document, "mousedown", (e) => {
      const target = e.target;
      if (target.closest(".rc-selection-menu, .rc-popover, .rc-modal")) {
        return;
      }
      this.isMouseSelecting = true;
    });
    this.registerDomEvent(document, "mouseup", (e) => {
      if (!this.isMouseSelecting) return;
      this.isMouseSelecting = false;
      const target = e.target;
      if (target.closest(".rc-selection-menu, .rc-popover, .rc-modal, .rc-sidebar-actions")) {
        return;
      }
      window.setTimeout(() => {
        this.handleSelectionEvent(e);
      }, 30);
    });
    this.registerDomEvent(
      document,
      "touchstart",
      (e) => {
        const target = e.target;
        if (target.closest(".rc-selection-menu, .rc-popover, .rc-modal")) {
          return;
        }
        this.isTouchSelecting = true;
        if (e.touches && e.touches.length > 0) {
          this.lastTouchCoords = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
          };
        }
      },
      { passive: true }
    );
    this.registerDomEvent(
      document,
      "touchmove",
      (e) => {
        if (e.touches && e.touches.length > 0) {
          this.lastTouchCoords = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
          };
        }
      },
      { passive: true }
    );
    this.registerDomEvent(document, "touchend", (e) => {
      if (!this.isTouchSelecting) return;
      this.isTouchSelecting = false;
      const target = e.target;
      if (target.closest(".rc-selection-menu, .rc-popover, .rc-modal, .rc-sidebar-actions")) {
        return;
      }
      window.setTimeout(() => {
        this.handleSelectionEvent(e);
      }, 120);
    });
    this.registerDomEvent(document, "touchcancel", () => {
      this.isTouchSelecting = false;
    });
    this.registerDomEvent(document, "selectionchange", () => {
      if (this.selectionDebounceTimer !== null) {
        window.clearTimeout(this.selectionDebounceTimer);
      }
      this.selectionDebounceTimer = window.setTimeout(() => {
        this.selectionDebounceTimer = null;
        if (this.isMouseSelecting || this.isTouchSelecting) {
          return;
        }
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          if (this.selectionMenu.isOpen()) {
            const activeEl = document.activeElement;
            if (!activeEl?.closest(".rc-selection-menu, .rc-popover, .rc-modal")) {
              this.selectionMenu.hide();
            }
          }
          return;
        }
        const text = selection.toString().trim();
        if (text.length >= this.settings.minSelectionLength) {
          this.handleSelectionEvent();
        }
      }, 180);
    });
  }
  handleSelectionEvent(e) {
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian8.MarkdownView);
    if (!activeView) return;
    const currentMode = activeView.getMode();
    const isReadingMode = currentMode === "preview";
    const isEditingMode = currentMode === "source";
    if (isReadingMode && !this.settings.enableInReadingMode) return;
    if (isEditingMode && !this.settings.enableInEditingMode) return;
    const selection = window.getSelection();
    let text = selection?.toString().trim() || "";
    if (!text && isEditingMode) {
      try {
        text = activeView.editor.getSelection().trim();
      } catch {
      }
    }
    if (!text || text.length < this.settings.minSelectionLength) {
      return;
    }
    const anchorNode = selection?.anchorNode;
    const anchorEl = anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
    const isInsideActiveView = Boolean(anchorNode && activeView.contentEl.contains(anchorNode)) || Boolean(anchorEl && anchorEl.closest(".markdown-preview-view, .markdown-rendered, .cm-editor, .markdown-reading-view, .markdown-source-view")) || Boolean(activeView.containerEl.contains(document.activeElement));
    if (!isInsideActiveView) return;
    if (anchorEl?.closest(".view-header, .rc-selection-menu, .rc-popover, .rc-modal, .workspace-ribbon, .rc-sidebar-actions")) {
      return;
    }
    const activeFile = this.app.workspace.getActiveFile();
    let existing;
    const markEl = anchorNode?.parentElement?.closest("mark.rc-inline-highlight") || selection?.focusNode?.parentElement?.closest("mark.rc-inline-highlight");
    if (markEl?.dataset.rcId) {
      existing = this.storage.getAnnotationById(markEl.dataset.rcId);
    }
    if (!existing && activeFile) {
      existing = this.storage.findAnnotation(activeFile.path, text);
    }
    const coords = this.getSelectionCoordinates(e);
    this.selectionMenu.show(coords, text, existing);
  }
  getSelectionCoordinates(e) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top),
          bottomY: Math.round(rect.bottom)
        };
      }
      const clientRects = range.getClientRects();
      if (clientRects.length > 0) {
        const first = clientRects[0];
        const last = clientRects[clientRects.length - 1];
        return {
          x: Math.round(first.left + first.width / 2),
          y: Math.round(first.top),
          bottomY: Math.round(last.bottom)
        };
      }
    }
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian8.MarkdownView);
    if (activeView && activeView.getMode() === "source") {
      try {
        const editor = activeView.editor;
        const cursor = editor.getCursor("head");
        if (typeof editor.coordsAtPos === "function" && typeof editor.posToOffset === "function") {
          const coords = editor.coordsAtPos(editor.posToOffset(cursor));
          if (coords && coords.left && coords.top) {
            return {
              x: Math.round(coords.left),
              y: Math.round(coords.top),
              bottomY: Math.round(coords.bottom || coords.top + 20)
            };
          }
        }
      } catch {
      }
    }
    let clientX;
    let clientY;
    if (e) {
      if ("touches" in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ("changedTouches" in e && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else if ("clientX" in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      }
    }
    if (clientX === void 0 && this.lastTouchCoords) {
      clientX = this.lastTouchCoords.x;
      clientY = this.lastTouchCoords.y;
    }
    const fallbackX = clientX ?? Math.round(window.innerWidth / 2);
    const fallbackY = clientY ?? Math.round(window.innerHeight / 2);
    return {
      x: fallbackX,
      y: fallbackY,
      bottomY: fallbackY + 24
    };
  }
  // Action handlers
  async handleQuickHighlight(text, color, existingId) {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;
    let existing = existingId ? this.storage.getAnnotationById(existingId) : void 0;
    if (!existing) {
      existing = this.storage.findAnnotation(activeFile.path, text);
    }
    if (existing) {
      await this.storage.updateAnnotation(existing.id, { color });
      this.reapplyHighlightsForFile(activeFile.path);
      new import_obsidian8.Notice("Highlight color updated!");
      return;
    }
    await this.storage.addAnnotation({
      filePath: activeFile.path,
      fileTitle: activeFile.basename,
      text,
      color
    });
    this.reapplyHighlightsForFile(activeFile.path);
    new import_obsidian8.Notice("Highlighted text!");
  }
  handleAddNote(text, coords, existingItem) {
    const activeFile = this.app.workspace.getActiveFile();
    const targetCoords = coords || this.getSelectionCoordinates();
    const existing = existingItem || (activeFile ? this.storage.findAnnotation(activeFile.path, text) : void 0);
    if (existing) {
      this.noteModal.show({
        coords: targetCoords,
        initialText: existing.text,
        initialNote: existing.note,
        initialColor: existing.color,
        isExisting: true,
        onSave: async (note, color) => {
          await this.storage.updateAnnotation(existing.id, {
            note,
            color
          });
          if (activeFile) this.reapplyHighlightsForFile(activeFile.path);
          new import_obsidian8.Notice("Note updated!");
        },
        onDelete: async () => {
          await this.storage.deleteAnnotation(existing.id);
          if (activeFile) this.reapplyHighlightsForFile(activeFile.path);
          new import_obsidian8.Notice("Highlight deleted.");
        },
        onViewInPanel: () => this.activateView()
      });
      return;
    }
    this.noteModal.show({
      coords: targetCoords,
      initialText: text,
      initialColor: this.settings.defaultColor,
      isExisting: false,
      onSave: async (note, color) => {
        if (!activeFile) return;
        await this.storage.addAnnotation({
          filePath: activeFile.path,
          fileTitle: activeFile.basename,
          text,
          color,
          note
        });
        this.reapplyHighlightsForFile(activeFile.path);
        new import_obsidian8.Notice("Note saved!");
      },
      onViewInPanel: () => this.activateView()
    });
  }
  handleCopy(text) {
    navigator.clipboard.writeText(text);
    new import_obsidian8.Notice("Copied to clipboard!");
  }
  handleTranslate(text, coords) {
    const targetCoords = coords || this.getSelectionCoordinates();
    this.translateModal.show(
      targetCoords,
      text,
      this.settings.targetLanguage,
      this.settings.googleApiKey
    );
  }
  handleDefine(word, coords) {
    const targetCoords = coords || this.getSelectionCoordinates();
    const activeFile = this.app.workspace.getActiveFile();
    const contextSentence = this.extractContextFromSelection(word);
    this.definitionModal.show({
      coords: targetCoords,
      rawWord: word,
      contextSentence,
      sourceTitle: activeFile?.basename,
      sourcePath: activeFile?.path,
      enableVocabulary: this.settings.enableVocabulary,
      autoSaveVocabulary: this.settings.autoSaveVocabulary,
      onSaveVocabulary: async (defResult, ctx) => {
        return await this.vocabulary.saveWord({
          word,
          definitionResult: defResult,
          contextSentence: ctx || contextSentence,
          sourceTitle: activeFile?.basename,
          sourcePath: activeFile?.path
        });
      },
      isWordSaved: (w) => this.vocabulary.isWordSaved(w)
    });
  }
  async handleAddToVocabulary(word, coords) {
    const activeFile = this.app.workspace.getActiveFile();
    const contextSentence = this.extractContextFromSelection(word);
    await this.vocabulary.saveWord({
      word,
      contextSentence,
      sourceTitle: activeFile?.basename,
      sourcePath: activeFile?.path
    });
  }
  extractContextFromSelection(selectionText) {
    const cleanWord = selectionText.trim();
    if (!cleanWord) return "";
    const selection = window.getSelection();
    if (selection && selection.anchorNode) {
      const parent = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
      const blockEl = parent?.closest("p, li, blockquote, div.cm-line, h1, h2, h3, h4, h5, h6");
      const fullText = (blockEl ? blockEl.textContent : parent?.textContent) || "";
      if (fullText) {
        const sentence = this.extractSentenceContainingWord(fullText, cleanWord);
        if (sentence) return sentence;
      }
    }
    const activeView = this.app.workspace.getActiveViewOfType(import_obsidian8.MarkdownView);
    if (activeView && activeView.getMode() === "source") {
      try {
        const editor = activeView.editor;
        const cursor = editor.getCursor();
        const lineText = editor.getLine(cursor.line);
        const sentence = this.extractSentenceContainingWord(lineText, cleanWord);
        if (sentence) return sentence;
        if (lineText.trim()) return lineText.trim();
      } catch {
      }
    }
    return "";
  }
  extractSentenceContainingWord(fullText, word) {
    if (!fullText || !word) return "";
    const cleanFull = fullText.replace(/\s+/g, " ").trim();
    const sentences = cleanFull.split(/(?<=[.?!])\s+/);
    const lowerWord = word.toLowerCase();
    for (const s of sentences) {
      if (s.toLowerCase().includes(lowerWord)) {
        return s.trim();
      }
    }
    return cleanFull.length > 200 ? cleanFull.slice(0, 200) + "..." : cleanFull;
  }
  handleSearchVault(text) {
    const searchPlugin = this.app.internalPlugins?.getPluginById("global-search");
    if (searchPlugin && searchPlugin.instance) {
      searchPlugin.instance.openGlobalSearch(text);
    } else {
      new import_obsidian8.Notice(`Search query: ${text}`);
    }
  }
  openNoteModal(options) {
    this.noteModal.show(options);
  }
  openHighlightMenu(item, coords) {
    this.selectionMenu.show(coords, item.text, item);
  }
  reapplyHighlightsForFile(filePath) {
    if (!filePath) return;
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof import_obsidian8.MarkdownView && view.file?.path === filePath) {
        const previewEl = view.previewMode?.containerEl || view.contentEl;
        if (previewEl) {
          const renderedSections = previewEl.querySelectorAll(".markdown-rendered");
          if (renderedSections.length > 0) {
            renderedSections.forEach((c) => {
              if (c instanceof HTMLElement) {
                this.highlighter.applyHighlights(c, filePath);
              }
            });
          } else {
            this.highlighter.applyHighlights(previewEl, filePath);
          }
        }
      }
    }
  }
};
