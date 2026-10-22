import { App, Notice, TFile, normalizePath } from "obsidian";
import type ReaderCompanionPlugin from "./main";
import { DictionaryResult } from "./types";
import { DictionaryService } from "./dictionary";

export interface SaveWordOptions {
  word: string;
  definitionResult?: DictionaryResult | null;
  contextSentence?: string;
  sourceTitle?: string;
  sourcePath?: string;
  silent?: boolean;
}

export class VocabularyService {
  private app: App;
  private plugin: ReaderCompanionPlugin;

  constructor(plugin: ReaderCompanionPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }

  getHeadingPrefix(level: string): string {
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

  async isWordSaved(rawWord: string): Promise<boolean> {
    const cleanWord = rawWord.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!cleanWord) return false;

    const filePath = normalizePath(this.plugin.settings.vocabularyFilePath || "Vocabulary.md");
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
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

  async saveWord(options: SaveWordOptions): Promise<{ success: boolean; alreadyExists: boolean }> {
    const { word, contextSentence, sourceTitle, sourcePath, silent } = options;
    const cleanWord = word.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!cleanWord) {
      return { success: false, alreadyExists: false };
    }

    const file = await this.ensureVocabularyFile();
    if (!file) {
      if (!silent) new Notice("Reader Companion: Could not access vocabulary file.");
      return { success: false, alreadyExists: false };
    }

    const content = await this.app.vault.read(file);
    const escapedWord = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wordRegex = new RegExp(`^#{1,6}\\s+${escapedWord}\\s*$`, "im");

    if (wordRegex.test(content)) {
      if (!silent) {
        new Notice(`"${cleanWord}" is already in your vocabulary.`);
      }
      return { success: false, alreadyExists: true };
    }

    // Ensure frontmatter property exists on the file if option enabled
    await this.ensureFrontmatterProperty(file);

    // Look up definition if not already provided
    let defResult = options.definitionResult;
    if (!defResult) {
      try {
        defResult = await DictionaryService.lookup(cleanWord);
      } catch {
        // fallback
      }
    }

    const entryMarkdown = this.formatWordEntry(cleanWord, defResult, contextSentence, sourceTitle, sourcePath);

    // Re-read file content in case frontmatter was updated
    const currentContent = await this.app.vault.read(file);
    const trimmed = currentContent.trimEnd();
    const separator = trimmed ? "\n\n" : "";
    const newContent = `${trimmed}${separator}${entryMarkdown}\n`;

    await this.app.vault.modify(file, newContent);

    if (!silent) {
      new Notice(`Saved "${cleanWord}" to Vocabulary!`);
    }

    return { success: true, alreadyExists: false };
  }

  private formatWordEntry(
    cleanWord: string,
    defResult?: DictionaryResult | null,
    contextSentence?: string,
    sourceTitle?: string,
    sourcePath?: string
  ): string {
    const h = this.getHeadingPrefix(this.plugin.settings.vocabularyHeadingLevel || "h3");
    const capitalizedWord = cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1);

    const lines: string[] = [`${h} ${capitalizedWord}`];

    if (defResult?.meanings && defResult.meanings.length > 0) {
      const inflectionPrefix = defResult.inflectionNote ? ` *(${defResult.inflectionNote})*` : "";
      lines.push(`- **Definition**:${inflectionPrefix}`);

      for (const m of defResult.meanings) {
        const posName = m.partOfSpeech
          ? m.partOfSpeech.charAt(0).toUpperCase() + m.partOfSpeech.slice(1)
          : "General";
        lines.push(`  - **${posName}**:`);

        (m.definitions || []).forEach((d, idx) => {
          lines.push(`    ${idx + 1}. ${d.definition.trim()}`);
          if (d.example && d.example.trim()) {
            lines.push(`       - *e.g.* “${d.example.trim().replace(/^["“]+|["”]+$/g, "")}”`);
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

  private async ensureVocabularyFile(): Promise<TFile | null> {
    const rawPath = this.plugin.settings.vocabularyFilePath || "Vocabulary.md";
    const filePath = normalizePath(rawPath);

    const existing = this.app.vault.getAbstractFileByPath(filePath);
    if (existing instanceof TFile) {
      return existing;
    }

    // Ensure parent folders exist
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash > 0) {
      const folderPath = filePath.substring(0, lastSlash);
      const folder = this.app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await this.app.vault.createFolder(folderPath);
      }
    }

    // Build initial file content
    const initialLines: string[] = [];
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

  private async ensureFrontmatterProperty(file: TFile): Promise<void> {
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
}
