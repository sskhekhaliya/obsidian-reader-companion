import { HIGHLIGHT_COLORS } from "../types";
import { ICONS } from "./icons";

export interface NoteModalOptions {
  coords?: { x: number; y: number; bottomY?: number };
  initialText: string;
  initialNote?: string;
  initialColor?: string;
  isExisting?: boolean;
  onSave: (note: string, color: string) => void;
  onDelete?: () => void;
  onViewInPanel?: () => void;
}

export class NoteModal {
  private el: HTMLElement | null = null;
  private outsidePointerHandler: ((e: Event) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  show(options: NoteModalOptions): void {
    this.hide();

    let selectedColor = options.initialColor || HIGHLIGHT_COLORS[0].hex;

    this.el = document.createElement("div");
    this.el.className = "rc-popover rc-note-popover";

    // Header
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

    // Body
    const body = document.createElement("div");
    body.className = "rc-popover-body rc-note-body";

    // Quote snippet
    const quoteBox = document.createElement("div");
    quoteBox.className = "rc-quote-snippet";
    quoteBox.textContent = `“${options.initialText}”`;
    body.appendChild(quoteBox);

    // Textarea
    const textareaWrap = document.createElement("div");
    textareaWrap.className = "rc-textarea-wrap";

    const textarea = document.createElement("textarea");
    textarea.className = "rc-note-textarea";
    textarea.placeholder = "Write your note here... (Ctrl+Enter to save)";
    textarea.rows = 3;
    textarea.value = options.initialNote || "";
    textareaWrap.appendChild(textarea);
    body.appendChild(textareaWrap);

    // Color Swatches
    const colorRow = document.createElement("div");
    colorRow.className = "rc-color-row large";

    const colorDots: HTMLElement[] = [];
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

    // Footer actions
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
      this.outsidePointerHandler = (e: Event) => {
        const target = (e instanceof MouseEvent ? e.target : (e as TouchEvent).touches?.[0]?.target || e.target) as Node;
        if (this.el && target && !this.el.contains(target)) {
          this.hide();
        }
      };
      this.keydownHandler = (e: KeyboardEvent) => {
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

  private position(coords: { x: number; y: number; bottomY?: number }): void {
    if (!this.el) return;

    const estimatedHeight = 320;
    const rawX = typeof coords.x === "number" && !isNaN(coords.x) && coords.x > 0 ? coords.x : window.innerWidth / 2;
    const rawY = typeof coords.y === "number" && !isNaN(coords.y) && coords.y > 0 ? coords.y : window.innerHeight / 3;
    const bottomY = typeof coords.bottomY === "number" && !isNaN(coords.bottomY) ? coords.bottomY : rawY + 20;

    let posX = Math.max(190, Math.min(window.innerWidth - 190, rawX));
    const isNearBottom = rawY + estimatedHeight > window.innerHeight - 60;
    let topPos: number;
    let transform: string;

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

  hide(): void {
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
}
