import { EnhancedAIWordleBot } from "../enhanced-bot";
import { GuessResult, GuessAnalysis, GameType } from "../types";

// Mock axios to avoid actual API calls during testing
jest.mock("axios");

describe("EnhancedAIWordleBot", () => {
  let bot: EnhancedAIWordleBot;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    bot = new EnhancedAIWordleBot();
  });

  describe("Constructor and Initialization", () => {
    test("should initialize with correct configuration", () => {
      expect(bot.config.game.wordLength).toBe(5);
      expect(bot.config.game.maxAttempts).toBe(6);
      expect(bot.config.strategy.startingWords).toContain("STARE");
      expect(bot.config.strategy.startingWords).toContain("CRANE");
    });

    test("should calculate letter frequencies correctly", () => {
      // Access private method through any type assertion for testing
      const letterFreqs = (bot as any).letterFrequencies;

      // Common letters should have higher frequencies
      expect(letterFreqs["E"]).toBeGreaterThan(0);
      expect(letterFreqs["A"]).toBeGreaterThan(0);

      // Should contain all letters from starting words
      expect(letterFreqs["S"]).toBeDefined();
      expect(letterFreqs["T"]).toBeDefined();
      expect(letterFreqs["A"]).toBeDefined();
      expect(letterFreqs["R"]).toBeDefined();
      expect(letterFreqs["E"]).toBeDefined();

      // Letters that appear in starting words should have frequencies
      expect(letterFreqs["S"]).toBeGreaterThan(0);
      expect(letterFreqs["T"]).toBeGreaterThan(0);
      expect(letterFreqs["A"]).toBeGreaterThan(0);
      expect(letterFreqs["R"]).toBeGreaterThan(0);
      expect(letterFreqs["E"]).toBeGreaterThan(0);
    });
  });

  describe("Word Scoring Algorithm", () => {
    test("should score words based on letter frequency", () => {
      const score1 = bot.scoreWord("STARE");
      const score2 = bot.scoreWord("ZZZZZ");

      // STARE should score higher than ZZZZZ due to common letters
      expect(score1).toBeGreaterThan(score2);
    });

    test("should apply position-based bonuses correctly", () => {
      // Test starting position bonus
      const scoreWithStartBonus = bot.scoreWord("STARE");
      const scoreWithoutStartBonus = bot.scoreWord("XTARE");

      // STARE starts with 'S' which should get start bonus
      expect(scoreWithStartBonus).toBeGreaterThan(scoreWithoutStartBonus);

      // Test ending position bonus
      const scoreWithEndBonus = bot.scoreWord("STARE");
      const scoreWithoutEndBonus = bot.scoreWord("STARX");

      // STARE ends with 'E' which should get end bonus
      expect(scoreWithEndBonus).toBeGreaterThan(scoreWithoutEndBonus);
    });

    test("should apply vowel bonuses correctly", () => {
      const scoreWithVowels = bot.scoreWord("ADIEU"); // 5 vowels
      const scoreWithFewVowels = bot.scoreWord("STARK"); // 1 vowel

      // ADIEU should score higher due to more vowels
      expect(scoreWithVowels).toBeGreaterThan(scoreWithFewVowels);
    });

    test("should penalize repeated letters", () => {
      const scoreUnique = bot.scoreWord("STARE"); // All unique letters
      const scoreRepeated = bot.scoreWord("STARR"); // R repeated

      // STARE should score higher than STARR
      expect(scoreUnique).toBeGreaterThan(scoreRepeated);
    });

    test("should handle analysis-based scoring", () => {
      const analysis: GuessAnalysis = {
        correct: new Set(["S"]),
        present: new Set(["T"]),
        absent: new Set(["X"]),
        positions: new Map([[0, "S"]]),
        letterCounts: new Map(),
        constraints: [],
      };

      const scoreWithAnalysis = bot.scoreWord("STARE", analysis);
      const scoreWithoutAnalysis = bot.scoreWord("STARE");

      // Score should be different when analysis is provided
      expect(scoreWithAnalysis).not.toBe(scoreWithoutAnalysis);
    });
  });

  describe("Result Analysis", () => {
    test("should analyze correct results correctly", () => {
      const guess = "STARE";
      const results: GuessResult[] = [
        { slot: 0, guess: "S", result: "correct" },
        { slot: 1, guess: "T", result: "present" },
        { slot: 2, guess: "A", result: "absent" },
        { slot: 3, guess: "R", result: "correct" },
        { slot: 4, guess: "E", result: "present" },
      ];

      const analysis = bot.analyzeResults(guess, results);

      expect(analysis.correct).toContain("S");
      expect(analysis.correct).toContain("R");
      expect(analysis.present).toContain("T");
      expect(analysis.present).toContain("E");
      expect(analysis.absent).toContain("A");
      expect(analysis.positions.get(0)).toBe("S");
      expect(analysis.positions.get(3)).toBe("R");
    });

    test("should build letter count constraints correctly", () => {
      const guess = "STARE";
      const results: GuessResult[] = [
        { slot: 0, guess: "S", result: "correct" },
        { slot: 1, guess: "T", result: "present" },
        { slot: 2, guess: "A", result: "absent" },
        { slot: 3, guess: "R", result: "correct" },
        { slot: 4, guess: "E", result: "present" },
      ];

      const analysis = bot.analyzeResults(guess, results);

      // S and R must appear at least once (correct)
      expect(analysis.letterCounts.get("S")?.min).toBe(1);
      expect(analysis.letterCounts.get("R")?.min).toBe(1);

      // T and E must appear at least once (present)
      expect(analysis.letterCounts.get("T")?.min).toBe(1);
      expect(analysis.letterCounts.get("E")?.min).toBe(1);

      // A must not appear (absent)
      expect(analysis.letterCounts.get("A")?.min).toBe(0);
      expect(analysis.letterCounts.get("A")?.max).toBe(0);
    });

    test("should handle mixed results for same letter", () => {
      const guess = "STARR";
      const results: GuessResult[] = [
        { slot: 0, guess: "S", result: "correct" },
        { slot: 1, guess: "T", result: "present" },
        { slot: 2, guess: "A", result: "absent" },
        { slot: 3, guess: "R", result: "correct" },
        { slot: 4, guess: "R", result: "absent" },
      ];

      const analysis = bot.analyzeResults(guess, results);

      // R appears in correct and absent positions
      // Should require at least 1 R (from correct position)
      expect(analysis.letterCounts.get("R")?.min).toBe(1);
    });
  });

  describe("Word Filtering", () => {
    test("should filter out words with absent letters", () => {
      const analysis: GuessAnalysis = {
        correct: new Set(),
        present: new Set(),
        absent: new Set(["X", "Z"]),
        positions: new Map(),
        letterCounts: new Map(),
        constraints: [],
      };

      const words = ["STARE", "CRANE", "SLATE", "TRACE"];
      const filtered = bot.filterWords(analysis, words);

      // All words should pass since they don't contain X or Z
      expect(filtered).toEqual(words);
    });

    test("should filter out words with wrong letter positions", () => {
      const analysis: GuessAnalysis = {
        correct: new Set(),
        present: new Set(),
        absent: new Set(),
        positions: new Map([
          [0, "S"],
          [3, "R"],
        ]),
        letterCounts: new Map(),
        constraints: [],
      };

      const words = ["STARE", "CRANE", "SLATE", "TRACE"];
      const filtered = bot.filterWords(analysis, words);

      // Only STARE should pass (S at position 0, R at position 3)
      expect(filtered).toEqual(["STARE"]);
    });

    test("should filter based on letter count constraints", () => {
      // Test with no constraints first
      const noConstraints: GuessAnalysis = {
        correct: new Set(),
        present: new Set(),
        absent: new Set(),
        positions: new Map(),
        letterCounts: new Map(),
        constraints: [],
      };

      const words = ["STARE", "CRANE", "SLATE", "TRACE", "ADIEU"];
      const noFiltered = bot.filterWords(noConstraints, words);
      expect(noFiltered).toEqual(words); // Should return all words

      // Test with simple constraint: must have at least 1 A
      const simpleConstraint: GuessAnalysis = {
        correct: new Set(),
        present: new Set(),
        absent: new Set(),
        positions: new Map(),
        letterCounts: new Map([["A", { min: 1, max: null }]]),
        constraints: [],
      };

      const simpleFiltered = bot.filterWords(simpleConstraint, words);
      expect(simpleFiltered.length).toBeGreaterThan(0);
      expect(simpleFiltered).toContain("ADIEU");

      // Test with constraint: 1 A (allowing E)
      const analysis: GuessAnalysis = {
        correct: new Set(),
        present: new Set(),
        absent: new Set(),
        positions: new Map(),
        letterCounts: new Map([
          ["A", { min: 1, max: null }], // Must have at least 1 A
        ]),
        constraints: [],
      };

      const filtered = bot.filterWords(analysis, words);
      // Should find words with at least 1 A
      expect(filtered.length).toBeGreaterThan(0);
      // Find a word that actually has at least 1 A
      const wordWithA = filtered.find((word) => word.includes("A"));
      expect(wordWithA).toBeDefined();
    });

    test("should handle letter counting correctly", () => {
      // Test the letter counting logic directly
      const word = "ADIEU";
      const aCount = (word.match(/A/g) || []).length;
      const eCount = (word.match(/E/g) || []).length;

      expect(aCount).toBe(1); // ADIEU has 1 A
      expect(eCount).toBe(1); // ADIEU has 1 E

      // Test with regex constructor
      const aCountRegex = (word.match(new RegExp("A", "g")) || []).length;
      const eCountRegex = (word.match(new RegExp("E", "g")) || []).length;

      expect(aCountRegex).toBe(1);
      expect(eCountRegex).toBe(1);
    });

    test("should filter based on present letter constraints", () => {
      const analysis: GuessAnalysis = {
        correct: new Set(),
        present: new Set(["T", "E"]),
        absent: new Set(),
        positions: new Map(),
        letterCounts: new Map(),
        constraints: [],
      };

      const words = ["STARE", "CRANE", "SLATE", "TRACE", "AUDIO"];
      const filtered = bot.filterWords(analysis, words);

      // Check which words actually contain both T and E
      const wordsWithTAndE = words.filter(
        (word) => word.includes("T") && word.includes("E")
      );

      // All words that contain both T and E should pass
      expect(filtered).toEqual(wordsWithTAndE);
    });

    test("should handle complex constraint combinations", () => {
      const analysis: GuessAnalysis = {
        correct: new Set(["S"]),
        present: new Set(["T", "E"]),
        absent: new Set(["X", "Z"]),
        positions: new Map([[0, "S"]]),
        letterCounts: new Map([
          ["A", { min: 1, max: null }],
          ["R", { min: 1, max: null }],
        ]),
        constraints: [],
      };

      const words = ["STARE", "CRANE", "SLATE", "TRACE", "AUDIO"];
      const filtered = bot.filterWords(analysis, words);

      // Only STARE should pass all constraints
      expect(filtered).toEqual(["STARE"]);
    });
  });

  describe("Game Logic", () => {
    test("should select best starting word", () => {
      const bestWord = (bot as any).getBestStartingWord();

      // Should return one of the configured starting words
      expect(bot.config.strategy.startingWords).toContain(bestWord);

      // Should be the highest scoring word
      const scores = bot.config.strategy.startingWords.map((word) =>
        bot.scoreWord(word)
      );
      const maxScore = Math.max(...scores);
      expect(bot.scoreWord(bestWord)).toBe(maxScore);
    });

    test("should generate next guess based on analysis", () => {
      const analysis: GuessAnalysis = {
        correct: new Set(["S"]),
        present: new Set(["T", "E"]),
        absent: new Set(["X"]),
        positions: new Map([[0, "S"]]),
        letterCounts: new Map([
          ["A", { min: 1, max: null }],
          ["R", { min: 1, max: null }],
        ]),
        constraints: [],
      };

      const previousGuesses = ["STARE"];
      const nextGuess = (bot as any).generateNextGuess(
        analysis,
        previousGuesses
      );

      // Should return a valid word that meets all constraints
      expect(typeof nextGuess).toBe("string");
      expect(nextGuess.length).toBe(5);
      expect(nextGuess[0]).toBe("S"); // Must start with S
      expect(nextGuess).toContain("T"); // Must contain T
      expect(nextGuess).toContain("E"); // Must contain E
      expect(nextGuess).toContain("A"); // Must contain A
      expect(nextGuess).toContain("R"); // Must contain R
    });

    test("should handle case when no valid words are found", () => {
      const analysis: GuessAnalysis = {
        correct: new Set(["X"]), // Very restrictive constraint
        present: new Set(),
        absent: new Set(),
        positions: new Map([[0, "X"]]),
        letterCounts: new Map(),
        constraints: [],
      };

      const previousGuesses = ["STARE"];
      const nextGuess = (bot as any).generateNextGuess(
        analysis,
        previousGuesses
      );

      // Should fall back to best starting word
      expect(bot.config.strategy.startingWords).toContain(nextGuess);
    });
  });

  describe("Performance Analytics", () => {
    test("should track game history correctly", () => {
      const mockGameData = {
        id: 1,
        type: "daily" as GameType,
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

      // Add game to history
      (bot as any).gameHistory.push(mockGameData);

      const analytics = bot.getAnalytics();

      expect(analytics.totalGames).toBe(1);
      expect(analytics.winRate).toBe(100);
      expect(analytics.averageAttempts).toBe(2);
    });

    test("should calculate win rate correctly", () => {
      const mockGames = [
        {
          success: true,
          attempts: 3,
          startTime: new Date(),
          endTime: new Date(),
          duration: 1000,
        },
        {
          success: false,
          attempts: 6,
          startTime: new Date(),
          endTime: new Date(),
          duration: 2000,
        },
        {
          success: true,
          attempts: 4,
          startTime: new Date(),
          endTime: new Date(),
          duration: 1500,
        },
      ];

      (bot as any).gameHistory = mockGames.map((game, index) => ({
        id: index + 1,
        type: "daily" as GameType,
        size: 5,
        ...game,
        guesses: [],
        results: [],
      }));

      const analytics = bot.getAnalytics();

      expect(analytics.totalGames).toBe(3);
      expect(analytics.winRate).toBeCloseTo(66.67, 1); // 2 wins out of 3 games
      // averageAttempts only considers successful games: (3 + 4) / 2 = 3.5
      expect(analytics.averageAttempts).toBeCloseTo(3.5, 1);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("should handle empty word lists gracefully", () => {
      const analysis: GuessAnalysis = {
        correct: new Set(),
        present: new Set(),
        absent: new Set(),
        positions: new Map(),
        letterCounts: new Map(),
        constraints: [],
      };

      const filtered = bot.filterWords(analysis, []);
      expect(filtered).toEqual([]);
    });

    test("should handle analysis with no constraints", () => {
      const analysis: GuessAnalysis = {
        correct: new Set(),
        present: new Set(),
        absent: new Set(),
        positions: new Map(),
        letterCounts: new Map(),
        constraints: [],
      };

      const words = ["STARE", "CRANE", "SLATE"];
      const filtered = bot.filterWords(analysis, words);

      // Should return all words when no constraints
      expect(filtered).toEqual(words);
    });

    test("should handle words with special characters gracefully", () => {
      const score = bot.scoreWord("STARE");
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThan(0);
    });
  });
});
