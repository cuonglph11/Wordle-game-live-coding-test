import { EnhancedAIWordleBot } from "../enhanced-bot";
import type { ResultKind } from "../types";

async function testGameplay() {
  const bot = new EnhancedAIWordleBot();

  console.log("Testing ARISE scenario...");

  // Mock the makeGuess method to simulate the ARISE feedback
  const originalMakeGuess = bot.makeGuess.bind(bot);
  let attemptCount = 0;

  (bot as any).makeGuess = async (guess: string) => {
    attemptCount++;
    if (attemptCount === 1 && guess === "ARISE") {
      return [
        { slot: 0, guess: "A", result: "present" as ResultKind },
        { slot: 1, guess: "R", result: "absent" as ResultKind },
        { slot: 2, guess: "I", result: "absent" as ResultKind },
        { slot: 3, guess: "S", result: "present" as ResultKind },
        { slot: 4, guess: "E", result: "absent" as ResultKind },
      ];
    }
    return originalMakeGuess(guess);
  };

  // Play the game and check the result
  const gameResult = await bot.playGame();
  console.log("Game result:", gameResult);

  // Verify that ARAEE is not suggested
  if (gameResult.guesses.includes("ARAEE")) {
    console.error("❌ Test failed: Bot suggested ARAEE!");
  } else {
    console.log("✅ Test passed: Bot did not suggest ARAEE");
  }
}

testGameplay().catch(console.error);
