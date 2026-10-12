import { DictionaryService } from "../dictionary";
import { DictionaryResult } from "../types";
import { ICONS } from "./icons";

export class DefinitionModal {
  private el: HTMLElement | null = null;
  private mousedownHandler: ((e: MouseEvent) => void) | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  async show(coords: { x: number; y: number; bottomY?: number }, rawWord: string): Promise<void> {
    this.hide();

    const cleanWord = rawWord.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!cleanWord) return;

    this.el = document.createElement("div");
    this.el.className = "rc-popover rc-definition-popover";

    // Header
    const header = document.createElement("div");
    header.className = "rc-popover-header";

    const title = document.createElement("h3");
    title.className = "rc-popover-title lowercase";
    title.textContent = cleanWord.toLowerCase();
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "rc-circle-btn";
    closeBtn.title = "Close";
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener("click", () => this.hide());
    header.appendChild(closeBtn);

    this.el.appendChild(header);

    // Body container
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
    this.position(coords);

    // Click inside stop propagation
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

    // Fetch definition
    try {
      const result = await DictionaryService.lookup(cleanWord);
      if (!this.el) return;

      if (!result) {
        this.renderNotFound(body, cleanWord);
      } else {
        this.renderResult(body, result);
      }
    } catch {
      if (!this.el) return;
      this.renderNotFound(body, cleanWord);
    }
  }

  private position(coords: { x: number; y: number; bottomY?: number }): void {
    if (!this.el) return;

    const estimatedHeight = 350;
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

  private renderResult(body: HTMLElement, result: DictionaryResult): void {
    body.innerHTML = "";

    // Pronunciation & Audio row
    const audioObj = result.phonetics?.find(
      (p) => typeof p.audio === "string" && p.audio.trim().length > 0
    );
    DictionaryService.preloadAudio(result.word, audioObj?.audio);

    const phoneticText =
      result.phonetic ||
      result.phonetics?.find((p) => p.text && p.text.trim())?.text ||
      "";

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

    // Meanings
    if (result.meanings && result.meanings.length > 0) {
      for (const meaning of result.meanings) {
        const meaningBlock = document.createElement("div");
        meaningBlock.className = "rc-meaning-block";

        const posHeader = document.createElement("div");
        posHeader.className = "rc-part-of-speech";
        posHeader.textContent = meaning.partOfSpeech;
        meaningBlock.appendChild(posHeader);

        // Numbered definitions
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
              exP.textContent = `“${def.example}”`;
              contentDiv.appendChild(exP);
            }

            defItem.appendChild(contentDiv);
            defList.appendChild(defItem);
          });

          meaningBlock.appendChild(defList);
        }

        // Synonyms
        const synonyms = [
          ...(meaning.synonyms || []),
          ...(meaning.definitions?.flatMap((d) => d.synonyms || []) || [])
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

  private renderNotFound(body: HTMLElement, word: string): void {
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
