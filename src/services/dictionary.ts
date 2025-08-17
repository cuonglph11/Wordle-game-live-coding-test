import axios from "axios";
import config from "../config";
import { LRUCache } from "../utils/lru-cache";

export interface DictionaryService {
  isValidWord(word: string): Promise<boolean>;
  validateWords(words: string[]): Promise<string[]>;
}

export class FreeDictionaryService implements DictionaryService {
  private readonly primaryBaseUrl: string;
  private readonly fallbackBaseUrl: string;
  private readonly batchSize: number;
  private readonly delayBetweenBatches: number;
  private readonly timeout: number;
  private readonly cache: LRUCache<string, boolean>;

  constructor() {
    const dictConfig = config.api.dictionary;
    this.primaryBaseUrl = dictConfig.baseURL;
    this.fallbackBaseUrl = dictConfig.fallbackBaseURL;
    this.batchSize = dictConfig.batchSize;
    this.delayBetweenBatches = dictConfig.delayBetweenBatches;
    this.timeout = dictConfig.timeout;
    this.cache = new LRUCache<string, boolean>(
      dictConfig.cache.maxSize,
      dictConfig.cache.ttl
    );
  }

  private async fetchWithTimeout(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await axios.get(url, { signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async isValidWord(word: string): Promise<boolean> {
    const normalizedWord = word.toLowerCase();

    // Check cache first
    const cached = this.cache.get(normalizedWord);
    if (cached !== undefined) {
      return cached;
    }

    // Try primary API first
    try {
      const response = await this.fetchWithTimeout(
        `${this.primaryBaseUrl}/${normalizedWord}`
      );
      const isValid = response.status === 200;
      this.cache.set(normalizedWord, isValid);
      return isValid;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // If rate limited, try fallback API
        if (error.response?.status === 429) {
          console.warn(
            "Primary dictionary API rate limited, switching to fallback..."
          );
          try {
            const fallbackResponse = await this.fetchWithTimeout(
              `${this.fallbackBaseUrl}/${word.toLowerCase()}`
            );
            const isValid = fallbackResponse.status === 200;
            this.cache.set(normalizedWord, isValid);
            return isValid;
          } catch (fallbackError) {
            console.warn("Fallback dictionary API error:", fallbackError);
            return true; // Consider word valid to avoid blocking gameplay
          }
        }
        // Word not found
        if (error.response?.status === 404) {
          this.cache.set(normalizedWord, false);
          return false;
        }
      }
      // For network errors or timeouts, consider word valid
      console.warn(`Dictionary API error for word ${word}:`, error);
      return true;
    }
  }

  async validateWords(words: string[]): Promise<string[]> {
    const validWords: string[] = [];
    let useFallback = false;

    // Clean expired cache entries periodically
    this.cache.cleanExpired();

    // Process words in batches
    for (let i = 0; i < words.length; i += this.batchSize) {
      const batch = words.slice(i, i + this.batchSize);

      // Check cache first for each word in batch
      const uncachedWords = batch.filter((word) => {
        const normalizedWord = word.toLowerCase();
        const cached = this.cache.get(normalizedWord);
        if (cached !== undefined) {
          if (cached) {
            validWords.push(word);
          }
          return false;
        }
        return true;
      });

      // If all words were in cache, skip API call
      if (uncachedWords.length === 0) {
        continue;
      }

      try {
        const validations = await Promise.all(
          uncachedWords.map(async (word) => {
            try {
              if (!useFallback) {
                const response = await this.fetchWithTimeout(
                  `${this.primaryBaseUrl}/${word.toLowerCase()}`
                );
                return response.status === 200;
              } else {
                const response = await this.fetchWithTimeout(
                  `${this.fallbackBaseUrl}/${word.toLowerCase()}`
                );
                return response.status === 200;
              }
            } catch (error) {
              if (
                axios.isAxiosError(error) &&
                error.response?.status === 429 &&
                !useFallback
              ) {
                // Switch to fallback API for remaining batches
                console.warn(
                  "Switching to fallback API for remaining words..."
                );
                useFallback = true;
                // Retry this word with fallback
                const fallbackResponse = await this.fetchWithTimeout(
                  `${this.fallbackBaseUrl}/${word.toLowerCase()}`
                );
                return fallbackResponse.status === 200;
              }
              // For other errors, consider word valid
              return true;
            }
          })
        );

        uncachedWords.forEach((word, index) => {
          const normalizedWord = word.toLowerCase();
          const isValid = validations[index];
          this.cache.set(normalizedWord, isValid);
          if (isValid) {
            validWords.push(word);
          }
        });

        // Add delay between batches
        if (i + this.batchSize < words.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.delayBetweenBatches)
          );
        }
      } catch (error) {
        console.error("Batch validation error:", error);
        // If batch fails, consider uncached words valid to avoid blocking gameplay
        uncachedWords.forEach((word) => {
          const normalizedWord = word.toLowerCase();
          this.cache.set(normalizedWord, true); // Cache as valid to prevent repeated failures
          validWords.push(word);
        });
      }
    }

    return validWords;
  }
}
