import { ItemView, WorkspaceLeaf, TFile, Menu, Notice } from "obsidian";
import type ReaderCompanionPlugin from "../main";
import { AnnotationItem, HIGHLIGHT_COLORS } from "../types";
import { ICONS } from "./icons";

export const VIEW_TYPE_READER_COMPANION = "reader-companion-annotations-view";

export class ReaderCompanionView extends ItemView {
  private plugin: ReaderCompanionPlugin;
  private filterColor: string | null = null;
  private searchQuery: string = "";
  private showAllFiles: boolean = false;

  constructor(leaf: WorkspaceLeaf, plugin: ReaderCompanionPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_READER_COMPANION;
  }

  getDisplayText(): string {
    return "Annotations & Notes";
  }

  getIcon(): string {
    return "highlighter";
  }

  async onOpen(): Promise<void> {
    this.plugin.storage.on("changed", this.onDataChanged);
    this.registerEvent(this.app.workspace.on("file-open", () => this.render()));
    this.render();
  }

  async onClose(): Promise<void> {
    this.plugin.storage.off("changed", this.onDataChanged);
  }

  private onDataChanged = () => {
    this.render();
  };

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    if (!container) return;

    container.empty();
    container.addClass("rc-annotations-sidebar");

    const activeFile = this.app.workspace.getActiveFile();
    const activeFilePath = activeFile?.path || "";

    // Header section
    const header = container.createDiv({ cls: "rc-sidebar-header" });

    const titleRow = header.createDiv({ cls: "rc-sidebar-title-row" });
    const titleLeft = titleRow.createDiv({ cls: "rc-sidebar-title-left" });
    const titleEl = titleLeft.createEl("h4", { cls: "rc-sidebar-title" });
    titleEl.setText(this.showAllFiles ? "All Annotations" : (activeFile?.basename || "No Active Note"));

    const countBadge = titleLeft.createSpan({ cls: "rc-badge" });

    // Actions in title
    const headerActions = titleRow.createDiv({ cls: "rc-sidebar-actions" });

    // Toggle between current note & all notes
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

    // Export annotations as markdown
    const exportBtn = headerActions.createEl("button", {
      cls: "rc-sidebar-icon-btn",
      attr: { title: "Export annotations as markdown" }
    });
    exportBtn.innerHTML = ICONS.download;
    exportBtn.addEventListener("click", () => this.exportAnnotations());

    // Search bar with clear button
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
      this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
      if (this.searchQuery) {
        clearBtn.addClass("visible");
      } else {
        clearBtn.removeClass("visible");
      }
      this.renderList(listContainer, activeFilePath, countBadge);
    });

    // Color filter chips
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

    // List container
    const listContainer = container.createDiv({ cls: "rc-annotations-list" });
    this.renderList(listContainer, activeFilePath, countBadge);
  }

  private renderList(listContainer: HTMLElement, activeFilePath: string, countBadge?: HTMLElement): void {
    listContainer.empty();

    let items: AnnotationItem[] = this.showAllFiles
      ? this.plugin.storage.getAllAnnotations()
      : this.plugin.storage.getAnnotationsForFile(activeFilePath);

    // Apply color filter
    if (this.filterColor) {
      items = items.filter((item) => item.color.toLowerCase() === this.filterColor?.toLowerCase());
    }

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.text.toLowerCase().includes(query) ||
          (item.note && item.note.toLowerCase().includes(query)) ||
          item.fileTitle.toLowerCase().includes(query)
      );
    }

    if (countBadge) {
      countBadge.setText(items.length.toString());
    }

    if (items.length === 0) {
      const emptyState = listContainer.createDiv({ cls: "rc-empty-state" });
      emptyState.createDiv({ cls: "rc-empty-icon" }).innerHTML = ICONS.highlighter;
      emptyState.createEl("p", {
        text: this.showAllFiles
          ? "No highlights or notes recorded yet."
          : "No annotations in this note yet. Select text in reading mode to highlight or add notes!"
      });
      return;
    }

    for (const item of items) {
      this.renderAnnotationCard(listContainer, item);
    }
  }

  private renderAnnotationCard(container: HTMLElement, item: AnnotationItem): void {
    const card = container.createDiv({ cls: "rc-annotation-card" });
    card.dataset.id = item.id;

    // Left accent bar
    card.style.borderLeftColor = item.color;

    // Card top row (file title and 3-dot options menu)
    const topRow = card.createDiv({ cls: "rc-card-top-row" });

    const infoCol = topRow.createDiv({ cls: "rc-card-info" });
    const fileLink = infoCol.createSpan({ cls: "rc-card-file-link" });
    fileLink.setText(item.fileTitle);
    fileLink.title = "Source note: " + item.fileTitle;
    fileLink.addEventListener("click", () => {
      this.app.workspace.openLinkText(item.filePath, "", false);
    });

    // Three-dot vertical options menu
    const menuBtn = topRow.createEl("button", {
      cls: "rc-card-action-btn rc-more-btn",
      attr: { title: "Options" }
    });
    menuBtn.innerHTML = ICONS.moreVertical;
    menuBtn.addEventListener("click", (e: MouseEvent) => {
      e.stopPropagation();
      const menu = new Menu();

      // 1. Copy text
      menu.addItem((itemMenu) => {
        itemMenu
          .setTitle("Copy text")
          .setIcon("copy")
          .onClick(() => {
            navigator.clipboard.writeText(item.text);
            new Notice("Copied text to clipboard!");
          });
      });

      // 2. Edit / Add note
      menu.addItem((itemMenu) => {
        itemMenu
          .setTitle(item.note ? "Edit note" : "Add note")
          .setIcon("edit")
          .onClick(() => {
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

      // 3. Delete
      menu.addItem((itemMenu) => {
        itemMenu
          .setTitle("Delete")
          .setIcon("trash")
          .setWarning(true)
          .onClick(async () => {
            await this.plugin.storage.deleteAnnotation(item.id);
            new Notice("Deleted highlight.");
          });
      });

      menu.showAtMouseEvent(e);
    });

    // Highlight text quote
    const quoteEl = card.createDiv({ cls: "rc-card-quote" });
    quoteEl.style.backgroundColor = `color-mix(in srgb, ${item.color} 15%, transparent)`;
    quoteEl.setText(item.text);
    quoteEl.title = "Click to jump to text in document";
    quoteEl.addEventListener("click", () => {
      this.jumpToText(item.filePath, item.text, item.id);
    });

    // Attached note
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
      // Add note button
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

    // Timestamp at the bottom right corner
    const cardFooter = card.createDiv({ cls: "rc-card-footer" });
    const dateSpan = cardFooter.createSpan({ cls: "rc-card-date-bottom" });
    dateSpan.setText(this.formatDate(item.createdAt));
  }

  private async jumpToText(filePath: string, text: string, annotationId?: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!file || !(file instanceof TFile)) return;

    let targetLeaf = this.app.workspace.getLeavesOfType("markdown").find(
      (l) => (l.view as any)?.file?.path === filePath
    );

    if (!targetLeaf) {
      targetLeaf = this.app.workspace.getLeaf(false);
      await targetLeaf.openFile(file);
    }

    this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });

    // 1. Calculate the exact line number from file text to bypass DOM virtualization
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

    // 2. Command Obsidian to scroll to that line (mounts the virtualized section)
    if (lineNumber !== -1) {
      try {
        targetLeaf.setEphemeralState({ line: lineNumber, focus: true });
        const view = targetLeaf.view as any;
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
      } catch {}
    }

    // Ensure highlights are rendered on the newly mounted section
    this.plugin.reapplyHighlightsForFile(filePath);

    // 3. Fine-tuning precise DOM element scroll and pulse glow
    const tryScroll = (): boolean => {
      const view = targetLeaf?.view as any;
      if (!view) return false;

      // 3a. Exact mark with data-rc-id
      if (annotationId) {
        const mark = view.containerEl.querySelector(`mark[data-rc-id="${annotationId}"]`);
        if (mark && mark instanceof HTMLElement) {
          mark.scrollIntoView({ behavior: "smooth", block: "center" });
          mark.addClass("rc-pulse-highlight");
          setTimeout(() => mark.removeClass("rc-pulse-highlight"), 2000);
          return true;
        }
      }

      // 3b. Search DOM in preview container
      const previewContainer = view.previewMode?.containerEl || view.containerEl;
      const cleanSnippet = text.trim().slice(0, 35);

      const walker = document.createTreeWalker(previewContainer, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (node.textContent && node.textContent.includes(cleanSnippet)) {
          const el = node.parentElement;
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.addClass("rc-pulse-highlight");
            setTimeout(() => el.removeClass("rc-pulse-highlight"), 2000);
            return true;
          }
        }
      }

      return false;
    };

    // Retry once Obsidian finishes mounting the virtualized section
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

  private async exportAnnotations(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    const items = this.showAllFiles
      ? this.plugin.storage.getAllAnnotations()
      : (activeFile ? this.plugin.storage.getAnnotationsForFile(activeFile.path) : []);

    if (items.length === 0) return;

    let md = `# Reading Notes & Highlights\n\n`;
    if (!this.showAllFiles && activeFile) {
      md += `*Source Note: [[${activeFile.basename}]]*\n\n`;
    }

    for (const item of items) {
      md += `> ${item.text}\n\n`;
      if (item.note) {
        md += `**Note:** ${item.note}\n\n`;
      }
      if (this.showAllFiles) {
        md += `*File: [[${item.fileTitle}]] — ${this.formatDate(item.createdAt)}*\n\n`;
      }
      md += `---\n\n`;
    }

    await navigator.clipboard.writeText(md);
    alert("Copied annotations to clipboard as Markdown!");
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
}
