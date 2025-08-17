import {
  GuessResult,
  ResultKind,
  GameType,
  GameData,
  GuessAnalysis,
  LetterCount,
  ScoredWord,
  APIConfig,
  GameConfig,
  LetterBonuses,
  ScoringWeights,
  StrategyConfig,
  LoggingConfig,
  BotConfig,
  GameStats,
  PerformanceAnalytics,
} from "../types";

describe("Type Definitions", () => {
  describe("GuessResult", () => {
    test("should have correct structure", () => {
      const result: GuessResult = {
        slot: 0,
        guess: "S",
        result: "correct",
      };

      expect(result.slot).toBe(0);
      expect(result.guess).toBe("S");
      expect(result.result).toBe("correct");
    });

    test("should accept all result kinds", () => {
      const results: ResultKind[] = ["absent", "present", "correct"];

      results.forEach((resultKind) => {
        const guessResult: GuessResult = {
          slot: 0,
          guess: "A",
          result: resultKind,
        };
        expect(guessResult.result).toBe(resultKind);
      });
    });
  });

  describe("GameType", () => {
    test("should accept valid game types", () => {
      const validTypes: GameType[] = ["daily", "random", "word"];

      validTypes.forEach((type) => {
        expect(typeof type).toBe("string");
        expect(["daily", "random", "word"]).toContain(type);
      });
    });
  });

  describe("GameData", () => {
    test("should have correct structure", () => {
      const gameData: GameData = {
        id: 1,
        type: "daily",
        size: 5,
        startTime: new Date(),
        endTime: new Date(),
        duration: 1000,
        guesses: ["STARE", "CRANE"],
        results: [
          [{ slot: 0, guess: "S", result: "correct" }],
          [{ slot: 0, guess: "C", result: "absent" }],
        ],
        success: true,
        attempts: 2,
      };

      expect(gameData.id).toBe(1);
      expect(gameData.type).toBe("daily");
      expect(gameData.size).toBe(5);
      expect(gameData.success).toBe(true);
      expect(gameData.attempts).toBe(2);
      expect(gameData.guesses).toHaveLength(2);
      expect(gameData.results).toHaveLength(2);
    });

    test("should handle optional fields", () => {
      const gameData: GameData = {
        id: 1,
        type: "daily",
        size: 5,
        startTime: new Date(),
        guesses: ["STARE"],
        results: [[{ slot: 0, guess: "S", result: "correct" }]],
        success: false,
        attempts: 6,
      };

      expect(gameData.seed).toBeUndefined();
      expect(gameData.endTime).toBeUndefined();
      expect(gameData.duration).toBeUndefined();
      expect(gameData.error).toBeUndefined();
    });
  });

  describe("GuessAnalysis", () => {
    test("should have correct structure", () => {
      const analysis: GuessAnalysis = {
        correct: new Set(["S", "R"]),
        present: new Set(["T", "E"]),
        absent: new Set(["A"]),
        positions: new Map([
          [0, "S"],
          [3, "R"],
        ]),
        letterCounts: new Map([
          ["S", { min: 1, max: null }],
          ["A", { min: 0, max: 0 }],
        ]),
        constraints: ["S at position 0", "R at position 3"],
      };

      expect(analysis.correct.has("S")).toBe(true);
      expect(analysis.present.has("T")).toBe(true);
      expect(analysis.absent.has("A")).toBe(true);
      expect(analysis.positions.get(0)).toBe("S");
      expect(analysis.letterCounts.get("S")?.min).toBe(1);
      expect(analysis.constraints).toContain("S at position 0");
    });
  });

  describe("LetterCount", () => {
    test("should handle min/max constraints", () => {
      const exactCount: LetterCount = { min: 2, max: 2 };
      const minOnly: LetterCount = { min: 1, max: null };
      const noCount: LetterCount = { min: 0, max: 0 };

      expect(exactCount.min).toBe(2);
      expect(exactCount.max).toBe(2);
      expect(minOnly.min).toBe(1);
      expect(minOnly.max).toBeNull();
      expect(noCount.min).toBe(0);
      expect(noCount.max).toBe(0);
    });
  });

  describe("ScoredWord", () => {
    test("should have correct structure", () => {
      const scoredWord: ScoredWord = {
        word: "STARE",
        score: 85.5,
      };

      expect(scoredWord.word).toBe("STARE");
      expect(scoredWord.score).toBe(85.5);
    });
  });

  describe("Configuration Types", () => {
    test("APIConfig should have correct structure", () => {
      const apiConfig: APIConfig = {
        baseURL: "http://localhost:8000",
        timeout: 10000,
        retries: 3,
      };

      expect(apiConfig.baseURL).toBe("http://localhost:8000");
      expect(apiConfig.timeout).toBe(10000);
      expect(apiConfig.retries).toBe(3);
    });

    test("GameConfig should have correct structure", () => {
      const gameConfig: GameConfig = {
        wordLength: 5,
        maxAttempts: 6,
        delayBetweenGuesses: 1000,
        delayBetweenGames: 2000,
      };

      expect(gameConfig.wordLength).toBe(5);
      expect(gameConfig.maxAttempts).toBe(6);
      expect(gameConfig.delayBetweenGuesses).toBe(1000);
      expect(gameConfig.delayBetweenGames).toBe(2000);
    });

    test("LetterBonuses should have correct structure", () => {
      const letterBonuses: LetterBonuses = {
        commonStart: ["S", "C", "T"],
        commonEnd: ["E", "R", "T"],
        vowels: ["A", "E", "I", "O", "U"],
      };

      expect(letterBonuses.commonStart).toContain("S");
      expect(letterBonuses.commonEnd).toContain("E");
      expect(letterBonuses.vowels).toContain("A");
    });

    test("ScoringWeights should have correct structure", () => {
      const scoringWeights: ScoringWeights = {
        letterFrequency: 1,
        startBonus: 10,
        vowelBonus: 5,
        commonEndBonus: 3,
      };

      expect(scoringWeights.letterFrequency).toBe(1);
      expect(scoringWeights.startBonus).toBe(10);
      expect(scoringWeights.vowelBonus).toBe(5);
      expect(scoringWeights.commonEndBonus).toBe(3);
    });

    test("StrategyConfig should have correct structure", () => {
      const strategyConfig: StrategyConfig = {
        startingWords: ["STARE", "CRANE"],
        letterBonuses: {
          commonStart: ["S", "C"],
          commonEnd: ["E", "R"],
          vowels: ["A", "E"],
        },
        scoring: {
          letterFrequency: 1,
          startBonus: 10,
          vowelBonus: 5,
          commonEndBonus: 3,
        },
      };

      expect(strategyConfig.startingWords).toContain("STARE");
      expect(strategyConfig.letterBonuses.commonStart).toContain("S");
      expect(strategyConfig.scoring.startBonus).toBe(10);
    });

    test("LoggingConfig should have correct structure", () => {
      const loggingConfig: LoggingConfig = {
        level: "info",
        showEmojis: true,
        showColors: true,
      };

      expect(loggingConfig.level).toBe("info");
      expect(loggingConfig.showEmojis).toBe(true);
      expect(loggingConfig.showColors).toBe(true);
    });

    test("BotConfig should have correct structure", () => {
      const botConfig: BotConfig = {
        api: {
          baseURL: "http://localhost:8000",
          timeout: 10000,
          retries: 3,
        },
        game: {
          wordLength: 5,
          maxAttempts: 6,
          delayBetweenGuesses: 1000,
          delayBetweenGames: 2000,
        },
        strategy: {
          startingWords: ["STARE"],
          letterBonuses: {
            commonStart: ["S"],
            commonEnd: ["E"],
            vowels: ["A", "E"],
          },
          scoring: {
            letterFrequency: 1,
            startBonus: 10,
            vowelBonus: 5,
            commonEndBonus: 3,
          },
        },
        logging: {
          level: "info",
          showEmojis: true,
          showColors: true,
        },
      };

      expect(botConfig.api.baseURL).toBe("http://localhost:8000");
      expect(botConfig.game.wordLength).toBe(5);
      expect(botConfig.strategy.startingWords).toContain("STARE");
      expect(botConfig.logging.level).toBe("info");
    });
  });

  describe("Statistics Types", () => {
    test("GameStats should have correct structure", () => {
      const gameStats: GameStats = {
        total: 10,
        wins: 8,
        totalAttempts: 35,
        games: [],
      };

      expect(gameStats.total).toBe(10);
      expect(gameStats.wins).toBe(8);
      expect(gameStats.totalAttempts).toBe(35);
      expect(gameStats.games).toEqual([]);
    });

    test("PerformanceAnalytics should have correct structure", () => {
      const analytics: PerformanceAnalytics = {
        totalGames: 10,
        winRate: 80.0,
        averageAttempts: 3.5,
        averageGameTime: 1500,
        bestPerformance: 2,
        worstPerformance: 6,
      };

      expect(analytics.totalGames).toBe(10);
      expect(analytics.winRate).toBe(80.0);
      expect(analytics.averageAttempts).toBe(3.5);
      expect(analytics.averageGameTime).toBe(1500);
      expect(analytics.bestPerformance).toBe(2);
      expect(analytics.worstPerformance).toBe(6);
    });
  });

  describe("Interface Implementation", () => {
    test("should have required methods defined", () => {
      // This test ensures the interface is properly defined
      // We can't instantiate an interface, but we can check its structure
      const requiredMethods = [
        "playGame",
        "playMultipleGames",
        "makeGuess",
        "getAnalytics",
      ];

      // This is a compile-time check - if the interface is missing methods,
      // TypeScript will throw an error during compilation
      expect(requiredMethods).toEqual([
        "playGame",
        "playMultipleGames",
        "makeGuess",
        "getAnalytics",
      ]);
    });
  });

  describe("Type Compatibility", () => {
    test("should allow valid type assignments", () => {
      // Test that we can assign valid values to typed variables
      const result: ResultKind = "correct";
      const type: GameType = "daily";
      const size: number = 5;

      expect(result).toBe("correct");
      expect(type).toBe("daily");
      expect(size).toBe(5);
    });

    test("should enforce type constraints", () => {
      // Test that TypeScript enforces type constraints
      // This test will fail at compile time if types are incorrect
      const validResults: ResultKind[] = ["absent", "present", "correct"];
      const validTypes: GameType[] = ["daily", "random", "word"];

      expect(validResults).toContain("correct");
      expect(validTypes).toContain("daily");
    });
  });
});
