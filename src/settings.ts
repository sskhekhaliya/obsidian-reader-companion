import { App, PluginSettingTab, Setting } from "obsidian";
import type ReaderCompanionPlugin from "./main";
import { HIGHLIGHT_COLORS } from "./types";
import { SUPPORTED_LANGUAGES } from "./translator";

export class ReaderCompanionSettingTab extends PluginSettingTab {
  plugin: ReaderCompanionPlugin;

  constructor(app: App, plugin: ReaderCompanionPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Reader Companion Settings" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Customize popup triggers, translation target language, colors, and UI theme."
    });

    // Default Highlight Color
    new Setting(containerEl)
      .setName("Default Highlight Color")
      .setDesc("The default color chosen for quick highlighting.")
      .addDropdown((drop) => {
        for (const col of HIGHLIGHT_COLORS) {
          drop.addOption(col.hex, col.name);
        }
        drop.setValue(this.plugin.settings.defaultColor);
        drop.onChange(async (val) => {
          this.plugin.settings.defaultColor = val;
          await this.plugin.savePluginData();
        });
      });

    // Default Translation Language
    new Setting(containerEl)
      .setName("Default Translation Language")
      .setDesc("Target language used by the instant translator.")
      .addDropdown((drop) => {
        for (const lang of SUPPORTED_LANGUAGES) {
          drop.addOption(lang.code, lang.name);
        }
        drop.setValue(this.plugin.settings.targetLanguage);
        drop.onChange(async (val) => {
          this.plugin.settings.targetLanguage = val;
          await this.plugin.savePluginData();
        });
      });

    // Google Cloud Translation API Key
    new Setting(containerEl)
      .setName("Google Cloud Translation API Key (Optional)")
      .setDesc("If provided, your official Google Cloud Translation API will be used instead of the default free endpoint.")
      .addText((text) => {
        text
          .setPlaceholder("Enter your API key...")
          .setValue(this.plugin.settings.googleApiKey || "")
          .onChange(async (val) => {
            this.plugin.settings.googleApiKey = val.trim();
            await this.plugin.savePluginData();
          });
        text.inputEl.type = "password";
      });

    // Reading Mode toggle
    new Setting(containerEl)
      .setName("Enable in Reading View")
      .setDesc("Show selection popup menu when text is selected in Reading Mode.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enableInReadingMode);
        toggle.onChange(async (val) => {
          this.plugin.settings.enableInReadingMode = val;
          await this.plugin.savePluginData();
        });
      });

    // Editing / Live Preview Mode toggle
    new Setting(containerEl)
      .setName("Enable in Editing / Live Preview Mode")
      .setDesc("Show selection popup menu when text is selected in editing mode.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enableInEditingMode);
        toggle.onChange(async (val) => {
          this.plugin.settings.enableInEditingMode = val;
          await this.plugin.savePluginData();
        });
      });

    // UI Theme
    new Setting(containerEl)
      .setName("Popup UI Theme")
      .setDesc("Choose theme styling for the popup menus and modals.")
      .addDropdown((drop) => {
        drop.addOption("auto", "Auto (Match Obsidian)");
        drop.addOption("dark", "Dark");
        drop.addOption("light", "Light");
        drop.addOption("sepia", "Sepia (Warm Book Theme)");
        drop.setValue(this.plugin.settings.uiTheme);
        drop.onChange(async (val: any) => {
          this.plugin.settings.uiTheme = val;
          this.plugin.updateThemeClass();
          await this.plugin.savePluginData();
        });
      });

    // Auto-pronounce
    new Setting(containerEl)
      .setName("Auto-pronounce on Definition")
      .setDesc("Automatically play audio pronunciation when opening a definition popup.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.autoPronounce);
        toggle.onChange(async (val) => {
          this.plugin.settings.autoPronounce = val;
          await this.plugin.savePluginData();
        });
      });
  }
}
