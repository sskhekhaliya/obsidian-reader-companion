import { Plugin, WorkspaceLeaf, MarkdownView, Notice } from "obsidian";
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

export default class ReaderCompanionPlugin extends Plugin {
  data: ReaderCompanionData = {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    annotations: {}
  };

  settings: ReaderCompanionSettings = { ...DEFAULT_SETTINGS };

  storage!: StorageManager;
  highlighter!: DomHighlighter;

  private selectionMenu!: SelectionMenu;
  private definitionModal!: DefinitionModal;
  private translateModal!: TranslateModal;
  private noteModal!: NoteModal;

  private isMouseSelecting: boolean = false;

  async onload(): Promise<void> {
    await this.loadPluginData();

    this.storage = new StorageManager(this);
    this.highlighter = new DomHighlighter(this);

    // Initialize UI popups
    this.definitionModal = new DefinitionModal();
    this.translateModal = new TranslateModal();
    this.noteModal = new NoteModal();

    this.selectionMenu = new SelectionMenu({
      onAddNote: (text, coords, existing) => this.handleAddNote(text, coords, existing),
      onCopy: (text) => this.handleCopy(text),
      onTranslate: (text, coords) => this.handleTranslate(text, coords),
      onDefine: (word, coords) => this.handleDefine(word, coords),
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

    // Reapply highlights on file open
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (file) {
          setTimeout(() => {
            this.reapplyHighlightsForFile(file.path);
          }, 80);
        }
      })
    );

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
      id: "define-selected-word",
      name: "Define Selected Word",
      callback: () => {
        const selection = window.getSelection()?.toString().trim();
        if (selection) {
          const coords = this.getSelectionCoordinates();
          this.definitionModal.show(coords, selection);
        } else {
          new Notice("Please select a word to define.");
        }
      }
    });

    this.addCommand({
      id: "translate-selected-text",
      name: "Translate Selected Text",
      callback: () => {
        const selection = window.getSelection()?.toString().trim();
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

    this.updateThemeClass();
  }

  onunload(): void {
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
    this.registerDomEvent(document, "mousedown", (e: MouseEvent) => {
      // If clicking inside active popovers, don't trigger new selection logic
      const target = e.target as HTMLElement;
      if (target.closest(".rc-selection-menu, .rc-popover, .rc-modal")) {
        return;
      }
      this.isMouseSelecting = true;
    });

    this.registerDomEvent(document, "mouseup", (e: MouseEvent) => {
      if (!this.isMouseSelecting) return;
      this.isMouseSelecting = false;

      // Check if mouse released inside our UI
      const target = e.target as HTMLElement;
      if (target.closest(".rc-selection-menu, .rc-popover, .rc-modal, .rc-sidebar-actions")) {
        return;
      }

      setTimeout(() => {
        this.handleSelectionEvent(e);
      }, 30);
    });
  }

  private handleSelectionEvent(e: MouseEvent): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    const currentMode = activeView.getMode(); // "preview" (reading) or "source" (editing)
    const isReadingMode = currentMode === "preview";
    const isEditingMode = currentMode === "source";

    if (isReadingMode && !this.settings.enableInReadingMode) return;
    if (isEditingMode && !this.settings.enableInEditingMode) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const text = selection.toString().trim();
    if (text.length < this.settings.minSelectionLength) {
      return;
    }

    // Ensure the selection is within an Obsidian markdown preview or editor leaf
    const anchorNode = selection.anchorNode;
    const container = anchorNode?.parentElement?.closest(
      ".markdown-preview-view, .markdown-rendered, .cm-editor"
    );

    if (!container) return;

    const activeFile = this.app.workspace.getActiveFile();
    let existing: AnnotationItem | undefined;
    const markEl =
      (anchorNode?.parentElement?.closest("mark.rc-inline-highlight") as HTMLElement | null) ||
      (selection.focusNode?.parentElement?.closest("mark.rc-inline-highlight") as HTMLElement | null);
    if (markEl?.dataset.rcId) {
      existing = this.storage.getAnnotationById(markEl.dataset.rcId);
    }
    if (!existing && activeFile) {
      existing = this.storage.findAnnotation(activeFile.path, text);
    }
    const coords = this.getSelectionCoordinates(e);
    this.selectionMenu.show(coords, text, existing);
  }

  private getSelectionCoordinates(e?: MouseEvent): { x: number; y: number; bottomY?: number } {
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
    }

    // Fallback to mouse event coords
    return {
      x: e?.clientX ?? Math.round(window.innerWidth / 2),
      y: e?.clientY ?? Math.round(window.innerHeight / 2),
      bottomY: (e?.clientY ?? Math.round(window.innerHeight / 2)) + 20
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
    this.definitionModal.show(targetCoords, word);
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
