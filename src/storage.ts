import { Events } from "obsidian";
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
}
