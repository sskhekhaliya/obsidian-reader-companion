import { App } from "obsidian";
import { ReaderCompanionSettings } from "./types";

export class KeychainService {
  constructor(private app: App) {}

  /**
   * Checks whether Obsidian native SecretStorage (Keychain) is supported
   */
  isAvailable(): boolean {
    const secretStorage = (this.app as any).secretStorage;
    return Boolean(secretStorage && typeof secretStorage.getSecret === "function");
  }

  /**
   * Retrieves a secret by ID from Obsidian SecretStorage
   */
  getSecret(secretId: string): string | null {
    if (!this.isAvailable() || !secretId) return null;
    try {
      const secretStorage = (this.app as any).secretStorage;
      const val = secretStorage.getSecret(secretId);
      return typeof val === "string" ? val.trim() : null;
    } catch (e) {
      console.warn("Reader Companion: Failed to read secret from Keychain", e);
      return null;
    }
  }

  /**
   * Stores a secret into Obsidian SecretStorage (OS Keychain)
   */
  async setSecret(secretId: string, value: string): Promise<boolean> {
    if (!this.isAvailable() || !secretId) return false;
    try {
      const secretStorage = (this.app as any).secretStorage;
      if (typeof secretStorage.setSecret === "function") {
        await secretStorage.setSecret(secretId, value.trim());
        return true;
      }
    } catch (e) {
      console.error("Reader Companion: Failed to save to Keychain", e);
    }
    return false;
  }

  /**
   * Resolves the Google Cloud Translation API Key from Keychain or settings
   */
  getGoogleApiKey(settings: ReaderCompanionSettings): string {
    if (settings.useKeychain || settings.googleApiSecretId) {
      if (settings.googleApiSecretId) {
        const secret = this.getSecret(settings.googleApiSecretId);
        if (secret && typeof secret === "string" && secret.trim()) {
          return secret.trim();
        }
      }
    }
    return settings.googleApiKey ? settings.googleApiKey.trim() : "";
  }
}

