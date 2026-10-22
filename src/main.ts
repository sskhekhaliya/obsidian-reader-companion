import { Plugin, WorkspaceLeaf, MarkdownView, Notice, TFile, TAbstractFile } from "obsidian";
import {
  AnnotationItem,
  ReaderCompanionData,
  ReaderCompanionSettings,
  DEFAULT_SETTINGS
} from "./types";
import { StorageManager } from "./storage";
import { DomHighlighter } from "./highlighter";
import { SelectionMenu } from "./ui/selection-menu";
import { DefinitionModal } from "./ui/definition-modal";
import { TranslateModal } from "./ui/translate-modal";
import { NoteModal, NoteModalOptions } from "./ui/note-modal";
import { ReaderCompanionView, VIEW_TYPE_READER_COMPANION } from "./ui/annotations-view";
import { ReaderCompanionSettingTab } from "./settings";
import { VocabularyService } from "./vocabulary";

export default class ReaderCompanionPlugin extends Plugin {
  data: ReaderCompanionData = {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    annotations: {}
  };

  settings: ReaderCompanionSettings = { ...DEFAULT_SETTINGS };

  storage!: StorageManager;
  highlighter!: DomHighlighter;
  vocabulary!: VocabularyService;

  private selectionMenu!: SelectionMenu;
  private definitionModal!: DefinitionModal;
  private translateModal!: TranslateModal;
  private noteModal!: NoteModal;

  private isMouseSelecting: boolean = false;
  private isTouchSelecting: boolean = false;
  private selectionDebounceTimer: number | null = null;
  private lastTouchCoords: { x: number; y: number } | null = null;

  async onload(): Promise<void> {
    await this.loadPluginData();

    this.storage = new StorageManager(this);
    this.highlighter = new DomHighlighter(this);
    this.vocabulary = new VocabularyService(this);

    // Initialize UI popups
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
        new Notice("Highlight removed.");
      },
      onClose: () => {}
    });

    // Register Right Sidebar View
    this.registerView(
      VIEW_TYPE_READER_COMPANION,
      (leaf) => new ReaderCompanionView(leaf, this)
    );

    // Ribbon icon
    this.addRibbonIcon("highlighter", "Reader Companion: Annotations", () => {
      this.activateView();
    });

    // Settings Tab
    this.addSettingTab(new ReaderCompanionSettingTab(this.app, this));

    // Register Markdown Post Processor to render highlights non-destructively in Reading Mode
    this.registerMarkdownPostProcessor((el, ctx) => {
      if (ctx.sourcePath) {
        this.highlighter.applyHighlights(el, ctx.sourcePath);
      }
    });

    // Reapply highlights when annotations change
    this.storage.on("changed", (...data: unknown[]) => {
      const filePath = typeof data[0] === "string" ? data[0] : "";
      if (filePath) {
        this.reapplyHighlightsForFile(filePath);
      }
    });

    // Listen for file/folder renames or moves to dynamically update annotation paths
    this.registerEvent(
      this.app.vault.on("rename", async (file: TAbstractFile, oldPath: string) => {
        const newTitle = file instanceof TFile ? file.basename : undefined;
        const changed = await this.storage.handleRename(oldPath, file.path, newTitle);
        if (changed) {
          this.reapplyHighlightsForFile(file.path);
        }
      })
    );

    // Reapply highlights on file open & heal if previously moved
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

    // Reconcile moved files once vault workspace layout is ready
    this.app.workspace.onLayoutReady(() => {
      this.storage.reconcileAnnotations();
    });

    // Reapply highlights on layout change
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
          this.reapplyHighlightsForFile(activeFile.path);
        }
      })
    );

    // Register selection listeners
    this.registerDomEvents();

    // Register Commands
    this.addCommand({
      id: "open-annotations-panel",
      name: "Open Annotations & Highlights Sidebar",
      callback: () => this.activateView()
    });

    this.addCommand({
      id: "show-selection-menu",
      name: "Show Reader Companion Menu for Selection",
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;
        const selection = window.getSelection();
        let text = selection?.toString().trim();
        if (!text && activeView.getMode() === "source") {
          try {
            text = activeView.editor.getSelection().trim();
          } catch {
            // ignore
          }
        }
        if (text && text.length >= this.settings.minSelectionLength) {
          const coords = this.getSelectionCoordinates();
          this.handleSelectionEvent();
        } else {
          new Notice("Please select text first.");
        }
      }
    });

    this.addCommand({
      id: "define-selected-word",
      name: "Define Selected Word",
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        let selection = window.getSelection()?.toString().trim();
        if (!selection && activeView && activeView.getMode() === "source") {
          try {
            selection = activeView.editor.getSelection().trim();
          } catch {
            // ignore
          }
        }
        if (selection) {
          const coords = this.getSelectionCoordinates();
          this.handleDefine(selection, coords);
        } else {
          new Notice("Please select a word to define.");
        }
      }
    });

    this.addCommand({
      id: "add-selected-word-to-vocabulary",
      name: "Add Selected Word to Vocabulary",
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        let selection = window.getSelection()?.toString().trim();
        if (!selection && activeView && activeView.getMode() === "source") {
          try {
            selection = activeView.editor.getSelection().trim();
          } catch {
            // ignore
          }
        }
        if (selection) {
          const coords = this.getSelectionCoordinates();
          this.handleAddToVocabulary(selection, coords);
        } else {
          new Notice("Please select a word to add to vocabulary.");
        }
      }
    });

    this.addCommand({
      id: "translate-selected-text",
      name: "Translate Selected Text",
      callback: () => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        let selection = window.getSelection()?.toString().trim();
        if (!selection && activeView && activeView.getMode() === "source") {
          try {
            selection = activeView.editor.getSelection().trim();
          } catch {
            // ignore
          }
        }
        if (selection) {
          const coords = this.getSelectionCoordinates();
          this.translateModal.show(coords, selection, this.settings.targetLanguage);
        } else {
          new Notice("Please select text to translate.");
        }
      }
    });

    this.addCommand({
      id: "reload-annotations",
      name: "Reload Annotations from Vault (.reader-companion)",
      callback: async () => {
        await this.reloadVaultAnnotations();
        new Notice("Annotations reloaded from vault storage!");
      }
    });

    this.addCommand({
      id: "reconcile-annotations",
      name: "Reconcile moved / renamed notes (Auto-heal)",
      callback: async () => {
        const healed = await this.storage.reconcileAnnotations();
        if (healed > 0) {
          new Notice(`Reader Companion: Reconciled ${healed} note(s)!`);
        } else {
          new Notice("Reader Companion: All annotation locations are up to date.");
        }
      }
    });

    this.updateThemeClass();
  }

  onunload(): void {
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

  private readonly VAULT_STORAGE_DIR = ".reader-companion";
  private readonly VAULT_STORAGE_FILE = ".reader-companion/annotations.json";

  async loadPluginData(): Promise<void> {
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

    // Load annotations from vault-level file (.reader-companion/annotations.json)
    try {
      if (await this.app.vault.adapter.exists(this.VAULT_STORAGE_FILE)) {
        const content = await this.app.vault.adapter.read(this.VAULT_STORAGE_FILE);
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed === "object") {
          this.data.annotations = parsed;
        }
      } else if (Object.keys(this.data.annotations).length > 0) {
        // Migrate existing plugin data to vault-level file
        if (!(await this.app.vault.adapter.exists(this.VAULT_STORAGE_DIR))) {
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

  async savePluginData(): Promise<void> {
    this.data.settings = this.settings;
    await this.saveData(this.data);

    // Persist annotations to vault-level file (.reader-companion/annotations.json)
    try {
      if (!(await this.app.vault.adapter.exists(this.VAULT_STORAGE_DIR))) {
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

  async reloadVaultAnnotations(): Promise<void> {
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

  updateThemeClass(): void {
    document.body.removeClass("rc-theme-dark", "rc-theme-light", "rc-theme-sepia");
    if (this.settings.uiTheme !== "auto") {
      document.body.addClass(`rc-theme-${this.settings.uiTheme}`);
    }
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
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

  private registerDomEvents(): void {
    // 1. Mouse events (Desktop)
    this.registerDomEvent(document, "mousedown", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".rc-selection-menu, .rc-popover, .rc-modal")) {
        return;
      }
      this.isMouseSelecting = true;
    });

    this.registerDomEvent(document, "mouseup", (e: MouseEvent) => {
      if (!this.isMouseSelecting) return;
      this.isMouseSelecting = false;

      const target = e.target as HTMLElement;
      if (target.closest(".rc-selection-menu, .rc-popover, .rc-modal, .rc-sidebar-actions")) {
        return;
      }

      window.setTimeout(() => {
        this.handleSelectionEvent(e);
      }, 30);
    });

    // 2. Touch events (Mobile / Tablet / Touchscreen)
    this.registerDomEvent(
      document,
      "touchstart",
      (e: TouchEvent) => {
        const target = e.target as HTMLElement;
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
      (e: TouchEvent) => {
        if (e.touches && e.touches.length > 0) {
          this.lastTouchCoords = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
          };
        }
      },
      { passive: true }
    );

    this.registerDomEvent(document, "touchend", (e: TouchEvent) => {
      if (!this.isTouchSelecting) return;
      this.isTouchSelecting = false;

      const target = e.target as HTMLElement;
      if (target.closest(".rc-selection-menu, .rc-popover, .rc-modal, .rc-sidebar-actions")) {
        return;
      }

      // Allow mobile OS / webview to finalize selection handles and ranges
      window.setTimeout(() => {
        this.handleSelectionEvent(e);
      }, 120);
    });

    this.registerDomEvent(document, "touchcancel", () => {
      this.isTouchSelecting = false;
    });

    // 3. Selection change event (Handles mobile long-press selection, selection handles drag, select-all, etc.)
    this.registerDomEvent(document, "selectionchange", () => {
      if (this.selectionDebounceTimer !== null) {
        window.clearTimeout(this.selectionDebounceTimer);
      }

      this.selectionDebounceTimer = window.setTimeout(() => {
        this.selectionDebounceTimer = null;

        // If user is actively touching or dragging with mouse, wait until they lift finger/mouse
        if (this.isMouseSelecting || this.isTouchSelecting) {
          return;
        }

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          // If selection was cleared/collapsed, hide menu if user is not interacting with it
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

  private handleSelectionEvent(e?: MouseEvent | TouchEvent): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    const currentMode = activeView.getMode(); // "preview" (reading) or "source" (editing)
    const isReadingMode = currentMode === "preview";
    const isEditingMode = currentMode === "source";

    if (isReadingMode && !this.settings.enableInReadingMode) return;
    if (isEditingMode && !this.settings.enableInEditingMode) return;

    const selection = window.getSelection();
    let text = selection?.toString().trim() || "";

    // On mobile source mode, fallback to editor selection if window selection string is empty
    if (!text && isEditingMode) {
      try {
        text = activeView.editor.getSelection().trim();
      } catch {
        // ignore
      }
    }

    if (!text || text.length < this.settings.minSelectionLength) {
      return;
    }

    // Ensure the selection is within an Obsidian markdown preview or editor leaf
    const anchorNode = selection?.anchorNode;
    const anchorEl = anchorNode?.nodeType === Node.ELEMENT_NODE
      ? (anchorNode as Element)
      : anchorNode?.parentElement;

    const isInsideActiveView =
      Boolean(anchorNode && activeView.contentEl.contains(anchorNode)) ||
      Boolean(anchorEl && anchorEl.closest(".markdown-preview-view, .markdown-rendered, .cm-editor, .markdown-reading-view, .markdown-source-view")) ||
      Boolean(activeView.containerEl.contains(document.activeElement));

    if (!isInsideActiveView) return;

    // Disallow if inside headers, ribbon, or active Reader Companion UI
    if (anchorEl?.closest(".view-header, .rc-selection-menu, .rc-popover, .rc-modal, .workspace-ribbon, .rc-sidebar-actions")) {
      return;
    }

    const activeFile = this.app.workspace.getActiveFile();
    let existing: AnnotationItem | undefined;
    const markEl =
      (anchorNode?.parentElement?.closest("mark.rc-inline-highlight") as HTMLElement | null) ||
      (selection?.focusNode?.parentElement?.closest("mark.rc-inline-highlight") as HTMLElement | null);
    if (markEl?.dataset.rcId) {
      existing = this.storage.getAnnotationById(markEl.dataset.rcId);
    }
    if (!existing && activeFile) {
      existing = this.storage.findAnnotation(activeFile.path, text);
    }
    const coords = this.getSelectionCoordinates(e);
    this.selectionMenu.show(coords, text, existing);
  }

  private getSelectionCoordinates(e?: MouseEvent | TouchEvent): { x: number; y: number; bottomY?: number } {
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

      // If boundingClientRect is 0x0 (common on mobile multi-line selection or inline tags)
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

    // Try CodeMirror 6 editor coords if available
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.getMode() === "source") {
      try {
        const editor = activeView.editor as any;
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
        // ignore
      }
    }

    // Fallback to event coordinates (mouse or touch)
    let clientX: number | undefined;
    let clientY: number | undefined;

    if (e) {
      if ("touches" in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ("changedTouches" in e && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else if ("clientX" in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
    }

    if (clientX === undefined && this.lastTouchCoords) {
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
  private async handleQuickHighlight(text: string, color: string, existingId?: string): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) return;

    let existing = existingId ? this.storage.getAnnotationById(existingId) : undefined;
    if (!existing) {
      existing = this.storage.findAnnotation(activeFile.path, text);
    }

    if (existing) {
      await this.storage.updateAnnotation(existing.id, { color });
      this.reapplyHighlightsForFile(activeFile.path);
      new Notice("Highlight color updated!");
      return;
    }

    await this.storage.addAnnotation({
      filePath: activeFile.path,
      fileTitle: activeFile.basename,
      text,
      color
    });

    this.reapplyHighlightsForFile(activeFile.path);
    new Notice("Highlighted text!");
  }

  private handleAddNote(
    text: string,
    coords?: { x: number; y: number; bottomY?: number },
    existingItem?: AnnotationItem
  ): void {
    const activeFile = this.app.workspace.getActiveFile();
    const targetCoords = coords || this.getSelectionCoordinates();

    const existing =
      existingItem || (activeFile ? this.storage.findAnnotation(activeFile.path, text) : undefined);

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
          new Notice("Note updated!");
        },
        onDelete: async () => {
          await this.storage.deleteAnnotation(existing.id);
          if (activeFile) this.reapplyHighlightsForFile(activeFile.path);
          new Notice("Highlight deleted.");
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
        new Notice("Note saved!");
      },
      onViewInPanel: () => this.activateView()
    });
  }

  private handleCopy(text: string): void {
    navigator.clipboard.writeText(text);
    new Notice("Copied to clipboard!");
  }

  private handleTranslate(text: string, coords?: { x: number; y: number; bottomY?: number }): void {
    const targetCoords = coords || this.getSelectionCoordinates();
    this.translateModal.show(
      targetCoords,
      text,
      this.settings.targetLanguage,
      this.settings.googleApiKey
    );
  }

  private handleDefine(word: string, coords?: { x: number; y: number; bottomY?: number }): void {
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

  private async handleAddToVocabulary(word: string, coords?: { x: number; y: number; bottomY?: number }): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    const contextSentence = this.extractContextFromSelection(word);

    await this.vocabulary.saveWord({
      word,
      contextSentence,
      sourceTitle: activeFile?.basename,
      sourcePath: activeFile?.path
    });
  }

  extractContextFromSelection(selectionText: string): string {
    const cleanWord = selectionText.trim();
    if (!cleanWord) return "";

    // 1. Try DOM selection parent block
    const selection = window.getSelection();
    if (selection && selection.anchorNode) {
      const parent =
        selection.anchorNode.nodeType === Node.ELEMENT_NODE
          ? (selection.anchorNode as HTMLElement)
          : selection.anchorNode.parentElement;
      const blockEl = parent?.closest("p, li, blockquote, div.cm-line, h1, h2, h3, h4, h5, h6");
      const fullText = (blockEl ? blockEl.textContent : parent?.textContent) || "";
      if (fullText) {
        const sentence = this.extractSentenceContainingWord(fullText, cleanWord);
        if (sentence) return sentence;
      }
    }

    // 2. Fallback to active editor line if in edit mode
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView && activeView.getMode() === "source") {
      try {
        const editor = activeView.editor;
        const cursor = editor.getCursor();
        const lineText = editor.getLine(cursor.line);
        const sentence = this.extractSentenceContainingWord(lineText, cleanWord);
        if (sentence) return sentence;
        if (lineText.trim()) return lineText.trim();
      } catch {}
    }

    return "";
  }

  private extractSentenceContainingWord(fullText: string, word: string): string {
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

  private handleSearchVault(text: string): void {
    // Open Obsidian global search for this query
    const searchPlugin = (this.app as any).internalPlugins?.getPluginById("global-search");
    if (searchPlugin && searchPlugin.instance) {
      searchPlugin.instance.openGlobalSearch(text);
    } else {
      new Notice(`Search query: ${text}`);
    }
  }

  openNoteModal(options: NoteModalOptions): void {
    this.noteModal.show(options);
  }

  openHighlightMenu(item: AnnotationItem, coords: { x: number; y: number; bottomY?: number }): void {
    this.selectionMenu.show(coords, item.text, item);
  }

  reapplyHighlightsForFile(filePath: string): void {
    if (!filePath) return;
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === filePath) {
        const previewEl = ((view as any).previewMode?.containerEl || (view as any).contentEl) as HTMLElement | undefined;
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
}
