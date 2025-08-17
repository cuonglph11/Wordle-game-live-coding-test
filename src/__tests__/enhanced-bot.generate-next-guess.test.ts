import { EnhancedAIWordleBot } from "../enhanced-bot";
import type { GuessAnalysis } from "../types";
import type { DictionaryService } from "../services/dictionary";

jest.mock("../services/dictionary");

describe("generateNextGuess", () => {
  let bot: EnhancedAIWordleBot;
  let mockDictionaryService: jest.Mocked<DictionaryService>;

  beforeEach(() => {
    mockDictionaryService = {
      isValidWord: jest.fn(),
      validateWords: jest.fn(),
    };
    bot = new EnhancedAIWordleBot();
    (bot as any).dictionaryService = mockDictionaryService;
    
    // Default mock behavior - return empty for filterWords, valid words for beam search
    mockDictionaryService.validateWords.mockImplementation(async (words) => {
      if (words.length === 0) {
        return []; // Empty array input -> empty array output
      } else if (words.length > 50) {
        // Large array suggests beam search - return some valid candidates
        return ["SALTY", "SPASM", "BLATS"];
      } else {
        // Small array - just return first few words as valid
        return words.slice(0, 2);
      }
    });
  });

  it("handles ARISE->yellow A,S case correctly", async () => {
    const analysis: GuessAnalysis = {
      correct: new Set(),
      present: new Set(["A", "S"]),
      absent: new Set(["R", "I", "E"]),
      positions: new Map(),
      letterCounts: new Map([
        ["A", { min: 1, max: null }],
        ["S", { min: 1, max: null }],
        ["R", { min: 0, max: 0 }],
        ["I", { min: 0, max: 0 }],
        ["E", { min: 0, max: 0 }],
      ]),
      constraints: [],
    };

    const guess = await (bot as any).generateNextGuess(analysis, ["ARISE"]);

    // Verify dictionary validation was called
    expect(mockDictionaryService.validateWords).toHaveBeenCalled();

    // Verify the guess satisfies constraints
    expect(guess).not.toBe("ARISE");
    expect(guess).toMatch(/[A-Z]{5}/);
    expect(guess).toMatch(/.*A.*S.*|.*S.*A.*/); // Contains A and S
    expect(guess).not.toMatch(/[RIE]/); // Does not contain R, I, or E
  });

  it("uses beam search fallback when no valid candidates found", async () => {
    const analysis: GuessAnalysis = {
      correct: new Set(),
      present: new Set(["A", "S"]),
      absent: new Set(["R", "I", "E"]),
      positions: new Map(),
      letterCounts: new Map(),
      constraints: [],
    };

    const guess = await (bot as any).generateNextGuess(analysis, ["ARISE"]);

    // Verify beam search was used and produced a valid word
    expect(mockDictionaryService.validateWords).toHaveBeenCalled();
    expect(guess).toMatch(/[A-Z]{5}/);
    expect(guess).not.toBe("ARAEE");
  });
});
