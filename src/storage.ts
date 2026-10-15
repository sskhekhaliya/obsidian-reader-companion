import { Events, TFile, TAbstractFile } from "obsidian";
import type ReaderCompanionPlugin from "./main";
import { AnnotationItem } from "./types";

export class StorageManager extends Events {
  private plugin: ReaderCompanionPlugin;

  constructor(plugin: ReaderCompanionPlugin) {
    super();
    this.plugin = plugin;
  }

  getAnnotationsForFile(filePath: string): AnnotationItem[] {
    const list = this.plugin.data.annotations[filePath] || [];
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }

  hasAnnotationsForFile(filePath: string): boolean {
    const list = this.plugin.data.annotations[filePath];
    return !!(list && list.length > 0);
  }

  getAllAnnotations(): AnnotationItem[] {
    const all: AnnotationItem[] = [];
    for (const filePath of Object.keys(this.plugin.data.annotations)) {
      all.push(...this.plugin.data.annotations[filePath]);
    }
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  findAnnotation(filePath: string, text: string): AnnotationItem | undefined {
    const list = this.getAnnotationsForFile(filePath);
    const clean = text.trim();
    if (!clean) return undefined;
    const cleanNorm = clean.replace(/\s+/g, " ");

    return list.find((a) => {
      const aText = a.text.trim();
      return (
        aText === clean ||
        aText.replace(/\s+/g, " ") === cleanNorm ||
        (clean.length > 8 && aText.includes(clean)) ||
        (aText.length > 8 && clean.includes(aText))
      );
    });
  }

  getAnnotationById(id: string): AnnotationItem | undefined {
    for (const filePath of Object.keys(this.plugin.data.annotations)) {
      const found = this.plugin.data.annotations[filePath]?.find((a) => a.id === id);
      if (found) return found;
    }
    return undefined;
  }

  async addAnnotation(item: {
    filePath: string;
    fileTitle: string;
    text: string;
    color: string;
    note?: string;
  }): Promise<AnnotationItem> {
    const now = Date.now();
    const id = `rc_${now}_${Math.random().toString(36).substring(2, 9)}`;
    const newAnnotation: AnnotationItem = {
      id,
      filePath: item.filePath,
      fileTitle: item.fileTitle || "Untitled",
      text: item.text,
      color: item.color,
      note: item.note?.trim() || undefined,
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

  async updateAnnotation(id: string, updates: Partial<AnnotationItem>): Promise<boolean> {
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

  async deleteAnnotation(id: string): Promise<boolean> {
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

  async clearFile(filePath: string): Promise<void> {
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
  async handleRename(oldPath: string, newPath: string, newTitle?: string): Promise<boolean> {
    if (!oldPath || !newPath || oldPath === newPath) return false;

    let modified = false;

    // 1. Direct file rename / move
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

    // 2. Folder rename / move (prefix match)
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
  async resolveFile(filePath: string, fileTitle?: string, sampleText?: string): Promise<TFile | null> {
    // 1. Direct path check
    const direct = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (direct instanceof TFile) {
      return direct;
    }

    // 2. Obsidian metadata cache linkpath resolution
    const destByPath = this.plugin.app.metadataCache.getFirstLinkpathDest(filePath, "");
    if (destByPath instanceof TFile) {
      await this.handleRename(filePath, destByPath.path, destByPath.basename);
      return destByPath;
    }

    if (fileTitle) {
      const destByTitle = this.plugin.app.metadataCache.getFirstLinkpathDest(fileTitle, "");
      if (destByTitle instanceof TFile) {
        await this.handleRename(filePath, destByTitle.path, destByTitle.basename);
        return destByTitle;
      }
    }

    // 3. Search markdown files in vault by filename or basename
    const mdFiles = this.plugin.app.vault.getMarkdownFiles();
    const targetFileName = filePath.split("/").pop() || "";
    const cleanTitle = fileTitle || (targetFileName.endsWith(".md") ? targetFileName.slice(0, -3) : targetFileName);

    const candidates = mdFiles.filter((f) => {
      return (
        f.name === targetFileName ||
        f.basename === cleanTitle ||
        f.name.toLowerCase() === targetFileName.toLowerCase() ||
        f.basename.toLowerCase() === cleanTitle.toLowerCase()
      );
    });

    if (candidates.length === 1) {
      const matched = candidates[0];
      await this.handleRename(filePath, matched.path, matched.basename);
      return matched;
    }

    // If multiple candidates, test sampleText against content to disambiguate
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
          } catch {}
        }
      }
      const matched = candidates[0];
      await this.handleRename(filePath, matched.path, matched.basename);
      return matched;
    }

    // 4. Fallback search by sample quote across all markdown files if quote is substantial
    if (sampleText && sampleText.trim().length >= 20) {
      const cleanSample = sampleText.trim();
      for (const file of mdFiles) {
        try {
          const content = await this.plugin.app.vault.cachedRead(file);
          if (content.includes(cleanSample)) {
            await this.handleRename(filePath, file.path, file.basename);
            return file;
          }
        } catch {}
      }
    }

    return null;
  }

  /**
   * Checks if an opened file has orphaned annotations stored under an old or moved path,
   * and heals them dynamically.
   */
  async checkAndHealForFile(file: TFile): Promise<boolean> {
    if (this.hasAnnotationsForFile(file.path)) {
      return false;
    }

    const deadKeys: string[] = [];
    for (const key of Object.keys(this.plugin.data.annotations)) {
      const exists = this.plugin.app.vault.getAbstractFileByPath(key);
      if (!exists) {
        deadKeys.push(key);
      }
    }

    if (deadKeys.length === 0) return false;

    let healed = false;
    let fileContent: string | null = null;

    for (const deadKey of deadKeys) {
      const items = this.plugin.data.annotations[deadKey];
      if (!items || items.length === 0) continue;

      const firstItem = items[0];
      const deadFileName = deadKey.split("/").pop() || "";
      const matchesName =
        deadFileName === file.name ||
        firstItem.fileTitle === file.basename ||
        deadFileName.toLowerCase() === file.name.toLowerCase() ||
        firstItem.fileTitle.toLowerCase() === file.basename.toLowerCase();

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
  async reconcileAnnotations(): Promise<number> {
    let healedCount = 0;
    const paths = Object.keys(this.plugin.data.annotations);

    for (const path of paths) {
      const abstractFile = this.plugin.app.vault.getAbstractFileByPath(path);
      if (abstractFile instanceof TFile) {
        const items = this.plugin.data.annotations[path] || [];
        let titleChanged = false;
        for (const item of items) {
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
}
