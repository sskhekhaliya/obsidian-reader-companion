export interface HighlightColor {
  name: string;
  hex: string;
  bgLight: string;
  textLight: string;
  bgDark: string;
  textDark: string;
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { name: "Yellow", hex: "#fbbc04", bgLight: "#fef7e0", textLight: "#202124", bgDark: "#3e3215", textDark: "#fef0b3" },
  { name: "Red", hex: "#ea4335", bgLight: "#fce8e6", textLight: "#202124", bgDark: "#4a1816", textDark: "#f8d7da" },
  { name: "Green", hex: "#34a853", bgLight: "#e6f4ea", textLight: "#202124", bgDark: "#133820", textDark: "#ceead6" },
  { name: "Blue", hex: "#1a73e8", bgLight: "#e8f0fe", textLight: "#202124", bgDark: "#1a2d4b", textDark: "#d2e3fc" },
  { name: "Purple", hex: "#a142f4", bgLight: "#f3e8fd", textLight: "#202124", bgDark: "#351a4b", textDark: "#e9d5ff" }
];

export interface AnnotationItem {
  id: string;
  filePath: string;
  fileTitle: string;
  text: string;
  color: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReaderCompanionData {
  version: number;
  settings: ReaderCompanionSettings;
  annotations: Record<string, AnnotationItem[]>; // Keyed by filePath
}

export interface ReaderCompanionSettings {
  defaultColor: string;
  targetLanguage: string;
  googleApiKey: string;
  enableInReadingMode: boolean;
  enableInEditingMode: boolean;
  uiTheme: "auto" | "dark" | "light" | "sepia";
  autoPronounce: boolean;
  showSearchVault: boolean;
  minSelectionLength: number;
}

export const DEFAULT_SETTINGS: ReaderCompanionSettings = {
  defaultColor: "#fbbc04",
  targetLanguage: "en",
  googleApiKey: "",
  enableInReadingMode: true,
  enableInEditingMode: false,
  uiTheme: "auto",
  autoPronounce: false,
  showSearchVault: true,
  minSelectionLength: 1
};

export interface DictionaryDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
  synonyms?: string[];
}

export interface DictionaryResult {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings: DictionaryMeaning[];
}

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}
