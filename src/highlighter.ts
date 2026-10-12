import type ReaderCompanionPlugin from "./main";
import { AnnotationItem } from "./types";

export class DomHighlighter {
  private plugin: ReaderCompanionPlugin;

  constructor(plugin: ReaderCompanionPlugin) {
    this.plugin = plugin;
  }

  /**
   * Applies inline highlight marks across the reading mode container
   * without touching the markdown note on disk.
   */
  applyHighlights(container: HTMLElement, filePath: string): void {
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

  clearHighlights(container: HTMLElement): void {
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

  private highlightTextInContainer(container: HTMLElement, item: AnnotationItem): void {
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
        if (
          parent &&
          (parent.tagName === "MARK" ||
            parent.tagName === "SCRIPT" ||
            parent.tagName === "STYLE" ||
            parent.tagName === "BUTTON")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const matchingNodes: Node[] = [];
    let curr: Node | null;
    while ((curr = walker.nextNode())) {
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
        // If range spans across boundaries, gracefully skip
      }
    }
  }
}
