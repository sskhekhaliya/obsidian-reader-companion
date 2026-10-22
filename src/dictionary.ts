import { requestUrl } from "obsidian";
import { DictionaryResult, DictionaryMeaning } from "./types";

export class DictionaryService {
  private static cachedAudios: Map<string, HTMLAudioElement> = new Map();

  /**
   * Look up definition using Free Dictionary API, with fallback to Wiktionary.
   * Automatically resolves inflected/plural forms (e.g. "interactions" -> "interaction",
   * "peers" -> "peer") so full definitions, phonetics, and examples are always returned.
   */
  static async lookup(rawWord: string): Promise<DictionaryResult | null> {
    const cleanWord = rawWord.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (!cleanWord) return null;

    let result = await this.lookupDirect(cleanWord);

    // Check if the result is just an inflection pointer (e.g. "plural of interaction")
    const inflectionInfo = result ? this.extractInflectionInfo(result) : null;
    let targetRoot: string | null | undefined = inflectionInfo?.root;

    // If cleanWord didn't find results or was an inflection, attempt base word guessing
    if (!targetRoot && (!result || result.meanings.length === 0)) {
      targetRoot = this.guessBaseWord(cleanWord);
    }

    if (targetRoot && targetRoot.toLowerCase() !== cleanWord.toLowerCase()) {
      try {
        const rootResult = await this.lookupDirect(targetRoot);
        if (rootResult && rootResult.meanings && rootResult.meanings.length > 0) {
          return {
            word: cleanWord,
            rootWord: targetRoot,
            inflectionNote: inflectionInfo?.note || `plural/form of ${targetRoot}`,
            phonetic: rootResult.phonetic || result?.phonetic,
            phonetics:
              rootResult.phonetics && rootResult.phonetics.length > 0
                ? rootResult.phonetics
                : result?.phonetics,
            meanings: rootResult.meanings
          };
        }
      } catch {
        // Fall back to original result
      }
    }

    return result;
  }

  private static async lookupDirect(word: string): Promise<DictionaryResult | null> {
    // 1. Try Free Dictionary API
    try {
      const freeDictResult = await this.lookupFreeDict(word);
      if (freeDictResult) return freeDictResult;
    } catch {
      // Continue to fallback
    }

    // 2. Try Wiktionary REST API fallback
    try {
      const wiktionaryResult = await this.lookupWiktionary(word);
      if (wiktionaryResult) return wiktionaryResult;
    } catch {
      // Continue
    }

    return null;
  }

  private static extractInflectionInfo(result: DictionaryResult): { root: string; note: string } | null {
    if (!result.meanings || result.meanings.length === 0) return null;

    for (const meaning of result.meanings) {
      for (const defObj of meaning.definitions || []) {
        const def = defObj.definition.trim();
        const match = def.match(
          /^(?:plural|third-person\s+singular(?:\s+simple\s+present)?|past\s+tense|past\s+participle|present\s+participle|comparative|superlative|alternative\s+(?:spelling|form))\s+of\s+(?:the\s+)?(?:word\s+)?["'“]?([a-zA-Z\p{L}'-]+)["'”]?\.?$/iu
        );
        if (match && match[1]) {
          return {
            root: match[1].toLowerCase().trim(),
            note: def
          };
        }
      }
    }
    return null;
  }

  private static guessBaseWord(word: string): string | null {
    const lower = word.toLowerCase();
    if (lower.length <= 3) return null;

    if (lower.endsWith("ies") && lower.length > 4) {
      return lower.slice(0, -3) + "y";
    }
    if (lower.endsWith("es") && lower.length > 4) {
      return lower.slice(0, -2);
    }
    if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) {
      return lower.slice(0, -1);
    }
    if (lower.endsWith("ed") && lower.length > 4) {
      return lower.slice(0, -2);
    }
    if (lower.endsWith("ing") && lower.length > 5) {
      return lower.slice(0, -3);
    }

    return null;
  }

  private static async lookupFreeDict(word: string): Promise<DictionaryResult | null> {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`;
    const response = await requestUrl({
      url,
      method: "GET",
      headers: { Accept: "application/json" }
    });

    if (response.status === 200 && Array.isArray(response.json) && response.json.length > 0) {
      const item = response.json[0];
      return {
        word: item.word || word,
        phonetic: item.phonetic,
        phonetics: item.phonetics,
        meanings: item.meanings || []
      };
    }
    return null;
  }

  private static async lookupWiktionary(word: string): Promise<DictionaryResult | null> {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word.toLowerCase())}`;
    const response = await requestUrl({
      url,
      method: "GET",
      headers: { Accept: "application/json" }
    });

    if (response.status === 200 && response.json && response.json.en) {
      const sections = response.json.en;
      if (Array.isArray(sections) && sections.length > 0) {
        const meanings: DictionaryMeaning[] = [];

        for (const sec of sections) {
          const partOfSpeech = sec.partOfSpeech || "General";
          const defs = (sec.definitions || [])
            .map((d: any) => {
              const rawDef = typeof d.definition === "string" ? d.definition : "";
              const cleanDef = rawDef.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
              let example: string | undefined;
              if (Array.isArray(d.examples) && d.examples.length > 0) {
                const rawEx = typeof d.examples[0] === "string" ? d.examples[0] : "";
                const cleanEx = rawEx.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
                if (cleanEx) example = cleanEx;
              }
              return cleanDef ? { definition: cleanDef, example } : null;
            })
            .filter(Boolean);

          if (defs.length > 0) {
            meanings.push({
              partOfSpeech,
              definitions: defs
            });
          }
        }

        if (meanings.length > 0) {
          return {
            word,
            meanings
          };
        }
      }
    }
    return null;
  }

  /**
   * Preload audio file in memory as soon as definition is loaded
   * so it plays with zero lag.
   */
  static preloadAudio(word: string, audioUrl?: string): void {
    if (!audioUrl) return;
    try {
      const fullUrl = audioUrl.startsWith("//") ? `https:${audioUrl}` : audioUrl;
      const audio = new Audio(fullUrl);
      audio.preload = "auto";
      this.cachedAudios.set(word.toLowerCase(), audio);
    } catch {}
  }

  /**
   * Play pronunciation audio instantly or fallback to local SpeechSynthesis.
   */
  static pronounce(word: string, audioUrl?: string): void {
    const cleanWord = word.trim();
    if (!cleanWord) return;

    // Check preloaded audio
    const cached = this.cachedAudios.get(cleanWord.toLowerCase());
    if (cached && cached.readyState >= 2) {
      cached.currentTime = 0;
      cached.play().catch(() => this.speak(cleanWord));
      return;
    }

    if (audioUrl) {
      try {
        const fullUrl = audioUrl.startsWith("//") ? `https:${audioUrl}` : audioUrl;
        const sound = new Audio(fullUrl);

        // Fallback timer: if network audio takes >250ms, play local TTS immediately
        let hasPlayed = false;
        const fallbackTimer = setTimeout(() => {
          if (!hasPlayed) {
            hasPlayed = true;
            this.speak(cleanWord);
          }
        }, 250);

        sound
          .play()
          .then(() => {
            hasPlayed = true;
            clearTimeout(fallbackTimer);
          })
          .catch(() => {
            clearTimeout(fallbackTimer);
            if (!hasPlayed) {
              hasPlayed = true;
              this.speak(cleanWord);
            }
          });
        return;
      } catch {
        // Fallback
      }
    }

    this.speak(cleanWord);
  }

  static speak(word: string): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      utterance.rate = 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const localVoice =
          voices.find((v) => v.lang.startsWith("en") && v.localService) ||
          voices.find((v) => v.lang.startsWith("en"));
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
