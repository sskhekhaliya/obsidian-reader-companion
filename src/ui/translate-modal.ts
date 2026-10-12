import { TranslatorService, SUPPORTED_LANGUAGES } from "../translator";
import { ICONS } from "./icons";

export class TranslateModal {
  private el: HTMLElement | null = null;
  private currentText: string = "";
  private currentTargetLang: string = "en";
  private apiKey?: string;
  private mousedownHandler: ((e: MouseEvent) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  async show(
    coords: { x: number; y: number; bottomY?: number },
    text: string,
    defaultTargetLang: string = "en",
    apiKey?: string
  ): Promise<void> {
    this.hide();

    this.currentText = text.trim();
    this.currentTargetLang = defaultTargetLang;
    this.apiKey = apiKey;
    if (!this.currentText) return;

    this.el = document.createElement("div");
    this.el.className = "rc-popover rc-translate-popover";

    // Header
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

    // Body
    const body = document.createElement("div");
    body.className = "rc-popover-body rc-translate-body";
    this.el.appendChild(body);

    document.body.appendChild(this.el);
    this.position(coords);

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

    await this.runTranslation();
  }

  private position(coords: { x: number; y: number; bottomY?: number }): void {
    if (!this.el) return;

    const estimatedHeight = 360;
    const rawX = typeof coords.x === "number" && !isNaN(coords.x) && coords.x > 0 ? coords.x : window.innerWidth / 2;
    const rawY = typeof coords.y === "number" && !isNaN(coords.y) && coords.y > 0 ? coords.y : window.innerHeight / 3;
    const bottomY = typeof coords.bottomY === "number" && !isNaN(coords.bottomY) ? coords.bottomY : rawY + 20;

    let posX = Math.max(200, Math.min(window.innerWidth - 200, rawX));
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

  private async runTranslation(): Promise<void> {
    if (!this.el) return;
    const body = this.el.querySelector(".rc-translate-body") as HTMLElement;
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

      const targetBox = body.querySelector(".rc-target-box") as HTMLElement;
      if (targetBox) {
        targetBox.className = "rc-target-box";
        targetBox.textContent = res.translatedText;
      }

      // Add actions row
      const existingFooter = body.querySelector(".rc-translate-footer");
      if (existingFooter) existingFooter.remove();

      const footer = document.createElement("div");
      footer.className = "rc-translate-footer";

      const leftActions = document.createElement("div");
      leftActions.className = "rc-footer-left";

      // Copy Button
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

      // Listen Button
      const listenBtn = document.createElement("button");
      listenBtn.type = "button";
      listenBtn.className = "rc-pill-btn";
      listenBtn.innerHTML = `${ICONS.volume}<span>Listen</span>`;
      listenBtn.addEventListener("click", () => {
        TranslatorService.speak(res.translatedText, this.currentTargetLang);
      });
      leftActions.appendChild(listenBtn);

      footer.appendChild(leftActions);

      // Web link button
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
      const targetBox = body.querySelector(".rc-target-box") as HTMLElement;
      if (targetBox) {
        targetBox.className = "rc-target-box";
        targetBox.innerHTML = `
          <span class="rc-error-text">Failed to translate. Check your internet connection.</span>
        `;
      }
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
  }
}
