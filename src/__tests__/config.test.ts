import config from "../config";

describe("Configuration", () => {
  describe("API Configuration", () => {
    test("should have valid API configuration", () => {
      expect(config.api).toBeDefined();
      expect(config.api.baseURL).toBeDefined();
      expect(typeof config.api.baseURL).toBe("string");
      expect(config.api.timeout).toBeGreaterThan(0);
      expect(config.api.retries).toBeGreaterThan(0);
    });

    test("should have reasonable timeout and retry values", () => {
      expect(config.api.timeout).toBeGreaterThanOrEqual(1000); // At least 1 second
      expect(config.api.timeout).toBeLessThanOrEqual(30000); // No more than 30 seconds
      expect(config.api.retries).toBeGreaterThanOrEqual(1); // At least 1 retry
      expect(config.api.retries).toBeLessThanOrEqual(10); // No more than 10 retries
    });
  });

  describe("Game Configuration", () => {
    test("should have valid game configuration", () => {
      expect(config.game).toBeDefined();
      expect(config.game.wordLength).toBe(5);
      expect(config.game.maxAttempts).toBe(6);
      expect(config.game.delayBetweenGuesses).toBeGreaterThan(0);
      expect(config.game.delayBetweenGames).toBeGreaterThan(0);
    });

    test("should have reasonable delay values", () => {
      expect(config.game.delayBetweenGuesses).toBeGreaterThanOrEqual(100); // At least 100ms
      expect(config.game.delayBetweenGuesses).toBeLessThanOrEqual(10000); // No more than 10s
      expect(config.game.delayBetweenGames).toBeGreaterThanOrEqual(500); // At least 500ms
      expect(config.game.delayBetweenGames).toBeLessThanOrEqual(30000); // No more than 30s
    });
  });

  describe("Strategy Configuration", () => {
    test("should have valid starting words", () => {
      expect(config.strategy.startingWords).toBeDefined();
      expect(Array.isArray(config.strategy.startingWords)).toBe(true);
      expect(config.strategy.startingWords.length).toBeGreaterThan(0);

      // All starting words should be 5 letters
      config.strategy.startingWords.forEach((word) => {
        expect(word.length).toBe(5);
        expect(word).toMatch(/^[A-Z]+$/); // Only uppercase letters
      });
    });

    test("should have optimal starting words", () => {
      const optimalWords = [
        "STARE",
        "CRANE",
        "SLATE",
        "TRACE",
        "ADIEU",
        "AUDIO",
      ];
      optimalWords.forEach((word) => {
        expect(config.strategy.startingWords).toContain(word);
      });
    });

    test("should have valid letter bonuses configuration", () => {
      expect(config.strategy.letterBonuses).toBeDefined();
      expect(config.strategy.letterBonuses.commonStart).toBeDefined();
      expect(config.strategy.letterBonuses.commonEnd).toBeDefined();
      expect(config.strategy.letterBonuses.vowels).toBeDefined();

      // Common start letters should be valid
      config.strategy.letterBonuses.commonStart.forEach((letter) => {
        expect(letter.length).toBe(1);
        expect(letter).toMatch(/^[A-Z]$/);
      });

      // Common end letters should be valid
      config.strategy.letterBonuses.commonEnd.forEach((letter) => {
        expect(letter.length).toBe(1);
        expect(letter).toMatch(/^[A-Z]$/);
      });

      // Vowels should be valid
      config.strategy.letterBonuses.vowels.forEach((letter) => {
        expect(letter.length).toBe(1);
        expect(["A", "E", "I", "O", "U"]).toContain(letter);
      });
    });

    test("should have valid scoring weights", () => {
      expect(config.strategy.scoring).toBeDefined();
      expect(typeof config.strategy.scoring.letterFrequency).toBe("number");
      expect(typeof config.strategy.scoring.startBonus).toBe("number");
      expect(typeof config.strategy.scoring.vowelBonus).toBe("number");
      expect(typeof config.strategy.scoring.commonEndBonus).toBe("number");

      // All scoring weights should be positive
      expect(config.strategy.scoring.letterFrequency).toBeGreaterThan(0);
      expect(config.strategy.scoring.startBonus).toBeGreaterThan(0);
      expect(config.strategy.scoring.vowelBonus).toBeGreaterThan(0);
      expect(config.strategy.scoring.commonEndBonus).toBeGreaterThan(0);
    });

    test("should have reasonable scoring weights", () => {
      // Start bonus should be higher than other bonuses (most important position)
      expect(config.strategy.scoring.startBonus).toBeGreaterThan(
        config.strategy.scoring.vowelBonus
      );
      expect(config.strategy.scoring.startBonus).toBeGreaterThan(
        config.strategy.scoring.commonEndBonus
      );

      // Vowel bonus should be significant but not overwhelming
      expect(config.strategy.scoring.vowelBonus).toBeGreaterThan(0);
      expect(config.strategy.scoring.vowelBonus).toBeLessThan(20);

      // Common end bonus should be smaller than start bonus
      expect(config.strategy.scoring.commonEndBonus).toBeLessThan(
        config.strategy.scoring.startBonus
      );
    });
  });

  describe("Logging Configuration", () => {
    test("should have valid logging configuration", () => {
      expect(config.logging).toBeDefined();
      expect(config.logging.level).toBeDefined();
      expect(typeof config.logging.showEmojis).toBe("boolean");
      expect(typeof config.logging.showColors).toBe("boolean");
    });

    test("should have valid log level", () => {
      const validLevels = ["error", "warn", "info", "debug"];
      expect(validLevels).toContain(config.logging.level);
    });
  });

  describe("Configuration Consistency", () => {
    test("should have consistent word length across configuration", () => {
      // Game word length should match starting words
      config.strategy.startingWords.forEach((word) => {
        expect(word.length).toBe(config.game.wordLength);
      });
    });

    test("should have reasonable max attempts", () => {
      // Max attempts should be reasonable for Wordle-like games
      expect(config.game.maxAttempts).toBeGreaterThanOrEqual(4); // At least 4 attempts
      expect(config.game.maxAttempts).toBeLessThanOrEqual(10); // No more than 10 attempts
    });

    test("should have enough starting words", () => {
      // Should have at least 5 starting words for variety
      expect(config.strategy.startingWords.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Environment Variable Handling", () => {
    test("should handle missing environment variables gracefully", () => {
      // Save original environment
      const originalLogLevel = process.env.LOG_LEVEL;

      // Test with missing environment variables
      delete process.env.LOG_LEVEL;

      // Re-import config to test environment variable handling
      jest.resetModules();
      const freshConfig = require("../config").default;

      expect(freshConfig.api.baseURL).toBe("https://wordle.votee.dev:8000");
      expect(freshConfig.logging.level).toBe("info");

      // Restore original environment
      if (originalLogLevel) process.env.LOG_LEVEL = originalLogLevel;
    });
  });
});
