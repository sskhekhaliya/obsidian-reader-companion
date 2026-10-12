# Reader Companion

**Reader Companion** is an elegant reading assistant plugin for Obsidian inspired by modern ebook readers. Whenever you select a word or passage in Reading Mode (or Live Preview), a sleek floating context menu appears, allowing you to instantly look up dictionary definitions, translate phrases into multiple languages, create non-destructive color highlights, and record notes into a dedicated right-side sidebar panel.

---

## ✨ Key Features

- **📖 Floating Selection Menu**:
  - Automatically appears when you select text in Obsidian Reading Mode.
  - Matches the modern, polished UI from ebook readers (curved glassmorphic cards, smooth animations, dark/light/sepia theme support).
  - Quick actions: **Add Note**, **Copy**, **Translate**, **Define** (automatically shown for single words), and **Search Vault**.
  - Direct 1-click color swatches at the bottom for instant highlighting.

- **📚 Instant Word Definitions**:
  - Full dictionary lookup powered by the **Free Dictionary API** with an automatic fallback to the **Wiktionary REST API**.
  - Phonetic pronunciation display with an audio playback button (or Web Speech API fallback).
  - Part of speech breakdown (*noun*, *verb*, *adjective*), numbered definitions, real usage examples, and synonyms.
  - Quick search fallback links to Google and Wiktionary.

- **🌐 Multi-Language Translator**:
  - Instant Google Translate integration supporting 20+ languages (English, Spanish, French, German, Hindi, Gujarati, Chinese, Japanese, Korean, Russian, Arabic, and more).
  - Works out-of-the-box with zero setup using Google's client endpoint.
  - **Optional Google Cloud Translation API**: If you have your own Google Cloud API Key, enter it in settings to use your dedicated cloud quota!
  - Audio pronunciation for translated phrases.
  - One-click copy and "Open in Google Translate" button.

- **🎨 Non-Destructive Highlights & Safe Vault Storage**:
  - **Zero file pollution**: Highlights and notes are saved non-destructively and do **not** clutter your original markdown files.
  - **Safe Vault Storage (`.reader-companion/annotations.json`)**: Stored directly in your vault root so your annotations survive plugin uninstalls and sync seamlessly across devices via Obsidian Sync, Git, or iCloud.
  - Inline marks appear seamlessly in Reading Mode.
  - 5 vibrant highlight colors: Yellow (`#fbbc04`), Red (`#ea4335`), Green (`#34a853`), Blue (`#1a73e8`), and Purple (`#a142f4`).

- **📑 Dedicated Right Sidebar View**:
  - Registers a custom right sidebar view (like Outlines, Properties, and Backlinks).
  - View all highlights and annotations for the current active note or across your entire vault.
  - Each highlight card features a **vertical three-dot menu** (Copy text, Edit/Add note, Delete) and a clean **timestamp in the bottom-right corner**.
  - Filter by color or search across notes and quotes.
  - Click any highlight card to jump right to that text in your document.
  - Export all annotations as formatted Markdown with one click.

---

## 🚀 Getting Started

1. Switch an active note to **Reading Mode** (or enable Live Preview in plugin settings).
2. Highlight any word or sentence with your mouse.
3. The floating menu will appear at your selection:
   - Click **Define** to inspect the word's pronunciation and meanings.
   - Click **Translate** to translate into your preferred language.
   - Click any **Color Circle** to highlight the passage.
   - Click **Add Note** to jot down a thought.
4. Click the highlighter ribbon icon on the left (or run `Reader Companion: Open Annotations & Highlights Sidebar`) to open the right-side annotations drawer!

---

## ⚙️ Settings

- **Default Highlight Color**: Choose your favorite default highlighter shade.
- **Default Translation Language**: Set your target language for instant translations.
- **Google Cloud Translation API Key (Optional)**: If specified, official Google Cloud Translation API is used.
- **Enable in Reading View**: Toggle popup in Reading view (default: Enabled).
- **Enable in Editing / Live Preview View**: Toggle popup in Live Preview.
- **Popup UI Theme**: Auto (Match Obsidian), Dark, Light, or Warm Sepia.
- **Auto-pronounce on Definition**: Automatically speak the word when definition modal opens.

---

## 🛠️ Build & Development

```bash
# Build production bundle
npm run build

# Watch mode for development
npm run dev

# Type check
npm run check
```

---

## ☕ Support

If you find **Reader Companion** helpful for your reading and note-taking workflow, consider supporting my work:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sskhekhaliya)

---

## 📄 License & Credits

- **Author**: [SSKhekhaliya](https://www.sskhekhaliya.in/)
- **Support**: [buymeacoffee.com/sskhekhaliya](https://buymeacoffee.com/sskhekhaliya)
- **License**: MIT License © [SSKhekhaliya](https://www.sskhekhaliya.in/)
- **APIs & Data**:
  - [Free Dictionary API](https://dictionaryapi.dev/) & [Wiktionary](https://en.wiktionary.org/) for dictionary definitions.
  - [Google Translate](https://translate.google.com/) for multi-language translations.
- Built with ❤️ for the [Obsidian](https://obsidian.md) community.
