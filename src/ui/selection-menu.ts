import { ICONS } from "./icons";
import { HIGHLIGHT_COLORS, AnnotationItem } from "../types";

export interface SelectionMenuCallbacks {
  onAddNote: (text: string, coords: { x: number; y: number; bottomY?: number }, existing?: AnnotationItem) => void;
  onCopy: (text: string) => void;
  onTranslate: (text: string, coords: { x: number; y: number; bottomY?: number }) => void;
  onDefine: (word: string, coords: { x: number; y: number; bottomY?: number }) => void;
  onSearchVault: (text: string) => void;
  onHighlight: (text: string, colorHex: string, existingId?: string) => void;
  onDeleteHighlight?: (id: string) => void;
  onClose: () => void;
}

export class SelectionMenu {
  private el: HTMLElement | null = null;
  private coords: { x: number; y: number; bottomY?: number } = { x: 0, y: 0 };
  private text: string = "";
  private cleanWord: string = "";
  private isSingleWord: boolean = false;
  private existing?: AnnotationItem;
  private callbacks: SelectionMenuCallbacks;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private mousedownHandler: ((e: MouseEvent) => void) | null = null;

  constructor(callbacks: SelectionMenuCallbacks) {
    this.callbacks = callbacks;
  }

  show(coords: { x: number; y: number; bottomY?: number }, text: string, existing?: AnnotationItem): void {
    this.hide();

    this.coords = { ...coords };
    this.text = text.trim();
    this.existing = existing;
    if (!this.text) return;

    this.cleanWord = this.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    const words = this.text.split(/\s+/).filter(Boolean);
    this.isSingleWord = words.length === 1 && this.cleanWord.length > 0;

    // Create container
    this.el = document.createElement("div");
    this.el.className = "rc-selection-menu";

    // Add items
    const listEl = document.createElement("div");
    listEl.className = "rc-menu-list";

    // 1. Note option (Edit note if note exists, or Add note)
    const noteIcon = this.existing?.note ? ICONS.edit : ICONS.addNote;
    const noteLabel = this.existing?.note ? "Edit note" : "Add note";
    this.createMenuItem(listEl, noteIcon, noteLabel, () => {
      const savedCoords = { ...this.coords };
      const savedExisting = this.existing;
      this.hide();
      this.callbacks.onAddNote(this.text, savedCoords, savedExisting);
    });

    // 2. Copy
    this.createMenuItem(listEl, ICONS.copy, "Copy", () => {
      this.hide();
      this.callbacks.onCopy(this.text);
    });

    // 3. Translate
    this.createMenuItem(listEl, ICONS.translate, "Translate", () => {
      const savedCoords = { ...this.coords };
      this.hide();
      this.callbacks.onTranslate(this.text, savedCoords);
    });

    // 4. Define (Only if single word)
    if (this.isSingleWord) {
      this.createMenuItem(listEl, ICONS.define, "Define", () => {
        const savedCoords = { ...this.coords };
        this.hide();
        this.callbacks.onDefine(this.cleanWord, savedCoords);
      });
    }

    // 5. Search Vault
    this.createMenuItem(listEl, ICONS.search, "Search vault", () => {
      this.hide();
      this.callbacks.onSearchVault(this.text);
    });

    // 6. Delete highlight (if existing)
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

    // Color Swatches Row
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

    // Compute position
    const menuWidth = 190;
    const estimatedHeight = (this.isSingleWord ? 240 : 200) + (this.existing ? 35 : 0);
    const isNearTop = coords.y - estimatedHeight < 20;

    let posX = coords.x;
    if (posX - menuWidth / 2 < 12) {
      posX = menuWidth / 2 + 12;
    } else if (posX + menuWidth / 2 > window.innerWidth - 12) {
      posX = window.innerWidth - menuWidth / 2 - 12;
    }

    let topPos: number;
    let transform: string;

    if (isNearTop && coords.bottomY) {
      topPos = coords.bottomY + 10;
      transform = "translate(-50%, 0)";
    } else {
      topPos = coords.y - 10;
      transform = "translate(-50%, -100%)";
    }

    this.el.style.left = `${posX}px`;
    this.el.style.top = `${topPos}px`;
    this.el.style.transform = transform;

    this.el.addEventListener("mousedown", (e) => e.stopPropagation());
    this.el.addEventListener("click", (e) => e.stopPropagation());

    setTimeout(() => {
      this.mousedownHandler = (e: MouseEvent) => {
        if (this.el && !this.el.contains(e.target as Node)) {
          this.hide();
        }
      };
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          this.hide();
        }
      };

      document.addEventListener("mousedown", this.mousedownHandler);
      document.addEventListener("keydown", this.keydownHandler);
    }, 50);
  }

  private createMenuItem(container: HTMLElement, iconSvg: string, title: string, onClick: () => void): void {
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

  hide(): void {
    if (this.mousedownHandler) {
      document.removeEventListener("mousedown", this.mousedownHandler);
      this.mousedownHandler = null;
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

  isOpen(): boolean {
    return this.el !== null;
  }
}
