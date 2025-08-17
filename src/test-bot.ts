import { EnhancedAIWordleBot } from "./enhanced-bot";
import { GuessResult } from "./types";

// Mock API responses for testing
class MockVoteeAPI {
  private currentWord: string;

  constructor() {
    this.currentWord = "STARE";
  }

  public setWord(word: string): void {
    this.currentWord = word.toUpperCase();
  }

  // Simulate API response
  public async makeGuess(guess: string): Promise<GuessResult[]> {
    console.log(
      `🔍 Mock API: Guessing "${guess}" against "${this.currentWord}"`
    );

    const results: GuessResult[] = [];
    for (let i = 0; i < guess.length; i++) {
      const guessChar = guess[i];
      const targetChar = this.currentWord[i];

      let result: "correct" | "present" | "absent";
      if (guessChar === targetChar) {
        result = "correct";
      } else if (this.currentWord.includes(guessChar)) {
        result = "present";
      } else {
        result = "absent";
      }

      results.push({
        slot: i,
        guess: guessChar,
        result: result,
      });
    }

    return results;
  }
}

// Test bot with mock API
async function testBot(): Promise<void> {
  console.log("🧪 Testing AI Wordle Bot with Mock API\n");

  const bot = new EnhancedAIWordleBot();
  const mockAPI = new MockVoteeAPI();

  // Override the bot's API call method
  bot.makeGuess = mockAPI.makeGuess.bind(mockAPI);

  // Test 1: Easy word
  console.log("=== Test 1: Easy Word ===");
  mockAPI.setWord("STARE");
  await bot.playGame("daily");

  console.log("\n" + "=".repeat(50) + "\n");

  // Test 2: Medium word
  console.log("=== Test 2: Medium Word ===");
  mockAPI.setWord("CRANE");
  await bot.playGame("daily");

  console.log("\n" + "=".repeat(50) + "\n");

  // Test 3: Harder word
  console.log("=== Test 3: Harder Word ===");
  mockAPI.setWord("ADIEU");
  await bot.playGame("daily");

  // Display final analytics
  console.log("\n📈 FINAL PERFORMANCE ANALYTICS");
  console.log("================================");
  const analytics = bot.getAnalytics();
  console.log(JSON.stringify(analytics, null, 2));
}

// Test word scoring
function testWordScoring(): void {
  console.log("\n🎯 Testing Word Scoring Algorithm\n");

  const bot = new EnhancedAIWordleBot();
  const testWords: string[] = [
    "STARE",
    "CRANE",
    "SLATE",
    "TRACE",
    "ADIEU",
    "AUDIO",
    "RAISE",
    "ARISE",
  ];

  console.log("Word Scoring Results:");
  console.log("=====================");

  const scoredWords: Array<{ word: string; score: number }> = testWords.map(
    (word: string) => ({
      word,
      score: bot.scoreWord(word),
    })
  );

  scoredWords.sort((a, b) => b.score - a.score);

  scoredWords.forEach((item, index) => {
    console.log(`${index + 1}. ${item.word}: ${item.score} points`);
  });
}

// Test constraint analysis
function testConstraintAnalysis(): void {
  console.log("\n🔍 Testing Constraint Analysis\n");

  const bot = new EnhancedAIWordleBot();

  // Simulate results from guessing "STARE" against "CRANE"
  const mockResults: GuessResult[] = [
    { slot: 0, guess: "S", result: "absent" },
    { slot: 1, guess: "T", result: "absent" },
    { slot: 2, guess: "A", result: "present" },
    { slot: 3, guess: "R", result: "present" },
    { slot: 4, guess: "E", result: "correct" },
  ];

  console.log('Mock Results from guessing "STARE" against "CRANE":');
  console.log("==================================================");
  mockResults.forEach((result, index) => {
    const emoji =
      result.result === "correct"
        ? "🟩"
        : result.result === "present"
        ? "🟨"
        : "⬜";
    console.log(
      `${emoji} ${result.guess} at position ${index}: ${result.result}`
    );
  });

  console.log("\nConstraint Analysis:");
  console.log("====================");
  const analysis = bot.analyzeResults("STARE", mockResults);

  console.log("Correct letters:", Array.from(analysis.correct));
  console.log("Present letters:", Array.from(analysis.present));
  console.log("Absent letters:", Array.from(analysis.absent));
  console.log("Correct positions:", Object.fromEntries(analysis.positions));

  // Test word filtering
  const filteredWords = bot.filterWords(analysis);
  console.log(`\nFiltered possible words: ${filteredWords.length}`);
  if (filteredWords.length > 0) {
    console.log("Top candidates:", filteredWords.slice(0, 5));
  }
}

// Run all tests
async function runAllTests(): Promise<void> {
  try {
    testWordScoring();
    testConstraintAnalysis();
    await testBot();

    console.log("\n✅ All tests completed successfully!");
  } catch (error) {
    console.error(
      "❌ Test execution failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

export { testBot, testWordScoring, testConstraintAnalysis };
