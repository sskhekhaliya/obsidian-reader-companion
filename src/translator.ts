import { requestUrl } from "obsidian";
import { TranslationResult } from "./types";

export interface SupportedLanguage {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "hi", name: "Hindi" },
  { code: "gu", name: "Gujarati" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ru", name: "Russian" },
  { code: "ar", name: "Arabic" },
  { code: "pt", name: "Portuguese" },
  { code: "it", name: "Italian" },
  { code: "nl", name: "Dutch" },
  { code: "tr", name: "Turkish" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "id", name: "Indonesian" },
  { code: "vi", name: "Vietnamese" },
  { code: "uk", name: "Ukrainian" },
  { code: "th", name: "Thai" }
];

export class TranslatorService {
  /**
   * Translate text to target language using either official Google Cloud Translation API (if API key provided)
   * or Google's client endpoint.
   */
  static async translate(
    text: string,
    targetLang: string = "en",
    apiKey?: string
  ): Promise<TranslationResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { translatedText: "" };
    }

    // 1. If user provided a Google Cloud Translation API key, use official endpoint
    if (apiKey && apiKey.trim().length > 0) {
      try {
        const cloudResult = await this.translateWithCloudApi(trimmed, targetLang, apiKey.trim());
        if (cloudResult) return cloudResult;
      } catch (err) {
        console.warn("Reader Companion: Google Cloud API error, falling back to free endpoint", err);
      }
    }

    // 2. Free client endpoint
    return this.translateWithFreeEndpoint(trimmed, targetLang);
  }

  private static async translateWithCloudApi(
    text: string,
    targetLang: string,
    apiKey: string
  ): Promise<TranslationResult | null> {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
    const response = await requestUrl({
      url,
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        format: "text"
      })
    });

    if (response.status === 200 && response.json?.data?.translations?.[0]) {
      const trans = response.json.data.translations[0];
      return {
        translatedText: trans.translatedText || text,
        detectedSourceLanguage: trans.detectedSourceLanguage
      };
    }
    return null;
  }

  private static async translateWithFreeEndpoint(
    trimmed: string,
    targetLang: string
  ): Promise<TranslationResult> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(trimmed)}`;

    try {
      const response = await requestUrl({
        url,
        method: "GET"
      });

      if (response.status === 200 && Array.isArray(response.json)) {
        const sentences = response.json[0];
        let translatedText = "";
        if (Array.isArray(sentences)) {
          for (const s of sentences) {
            if (Array.isArray(s) && typeof s[0] === "string") {
              translatedText += s[0];
            }
          }
        }

        const detectedSource = typeof response.json[2] === "string" ? response.json[2] : undefined;

        return {
          translatedText: translatedText || trimmed,
          detectedSourceLanguage: detectedSource
        };
      }

      return { translatedText: trimmed };
    } catch (err) {
      console.warn("Reader Companion: Translation API error", err);
      throw err;
    }
  }

  static getWebUrl(text: string, targetLang: string = "en"): string {
    return `https://translate.google.com/?sl=auto&tl=${encodeURIComponent(targetLang)}&text=${encodeURIComponent(
      text
    )}&op=translate`;
  }

  static speak(text: string, lang: string = "en"): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const langCode = lang.split("-")[0];
        const localVoice =
          voices.find((v) => v.lang.startsWith(langCode) && v.localService) ||
          voices.find((v) => v.lang.startsWith(langCode));
        if (localVoice) {
          utterance.voice = localVoice;
        }
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("SpeechSynthesis error", e);
    }
  }
}
