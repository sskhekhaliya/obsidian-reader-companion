import { App, Notice, PluginSettingTab, Setting } from "obsidian";
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

    // Vocabulary Tracking
    containerEl.createEl("h3", { text: "Vocabulary Tracking" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Save looked-up words, definitions, and sentence context into a dedicated file formatted for vocabulary tracking and flashcards (compatible with Goodreads Bookshelf)."
    });

    new Setting(containerEl)
      .setName("Enable Vocabulary Tracking")
      .setDesc("Enable vocabulary collection and saving.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enableVocabulary !== false);
        toggle.onChange(async (val) => {
          this.plugin.settings.enableVocabulary = val;
          await this.plugin.savePluginData();
        });
      });

    new Setting(containerEl)
      .setName("Auto-Save on Define")
      .setDesc(
        "Automatically save the word, definition, and sentence context to your vocabulary file whenever you click 'Define' (Kindle style). When disabled, an 'Add to vocabulary' option is displayed in the selection menu and definition popup."
      )
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.autoSaveVocabulary !== false);
        toggle.onChange(async (val) => {
          this.plugin.settings.autoSaveVocabulary = val;
          await this.plugin.savePluginData();
        });
      });

    new Setting(containerEl)
      .setName("Vocabulary File Path")
      .setDesc("Vault path to the markdown file where vocabulary entries are appended.")
      .addText((text) => {
        text
          .setPlaceholder("Vocabulary.md")
          .setValue(this.plugin.settings.vocabularyFilePath || "Vocabulary.md")
          .onChange(async (val) => {
            this.plugin.settings.vocabularyFilePath = val.trim() || "Vocabulary.md";
            await this.plugin.savePluginData();
          });
      });

    new Setting(containerEl)
      .setName("Vocabulary Heading Level")
      .setDesc("Heading level used for each word in the vocabulary file.")
      .addDropdown((drop) => {
        drop.addOption("h2", "H2 (##)");
        drop.addOption("h3", "H3 (###) — Default");
        drop.addOption("h4", "H4 (####)");
        drop.setValue(this.plugin.settings.vocabularyHeadingLevel || "h3");
        drop.onChange(async (val: any) => {
          this.plugin.settings.vocabularyHeadingLevel = val;
          await this.plugin.savePluginData();
        });
      });

    new Setting(containerEl)
      .setName("Add Frontmatter Property to Vocabulary")
      .setDesc("Include a frontmatter property in the vocabulary file (e.g. type: vocabulary) so flashcards or queries can find all vocabulary.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.addVocabularyProperty !== false);
        toggle.onChange(async (val) => {
          this.plugin.settings.addVocabularyProperty = val;
          await this.plugin.savePluginData();
        });
      });

    new Setting(containerEl)
      .setName("Vocabulary Property Key")
      .setDesc("YAML frontmatter key name for identifying the vocabulary file.")
      .addText((text) => {
        text
          .setPlaceholder("type")
          .setValue(this.plugin.settings.vocabularyPropertyKey || "type")
          .onChange(async (val) => {
            this.plugin.settings.vocabularyPropertyKey = val.trim() || "type";
            await this.plugin.savePluginData();
          });
      });

    new Setting(containerEl)
      .setName("Vocabulary Property Value")
      .setDesc("YAML frontmatter value for identifying the vocabulary file.")
      .addText((text) => {
        text
          .setPlaceholder("vocabulary")
          .setValue(this.plugin.settings.vocabularyPropertyValue || "vocabulary")
          .onChange(async (val) => {
            this.plugin.settings.vocabularyPropertyValue = val.trim() || "vocabulary";
            await this.plugin.savePluginData();
          });
      });

    // Vault Storage & Backup
    containerEl.createEl("h3", { text: "Data & Storage Persistence" });
    new Setting(containerEl)
      .setName("Vault Storage (.reader-companion/annotations.json)")
      .setDesc(
        "All highlights and notes are safely saved in your vault root (.reader-companion/annotations.json). Your data survives plugin uninstalls and syncs across devices via Obsidian Sync, Git, or iCloud."
      )
      .addButton((btn) => {
        btn.setButtonText("Reload from Vault");
        btn.setTooltip("Re-read annotations from .reader-companion/annotations.json");
        btn.onClick(async () => {
          await this.plugin.reloadVaultAnnotations();
          new Notice("Annotations reloaded from vault storage!");
        });
      });
  }
}
