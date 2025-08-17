import { EnhancedAIWordleBot } from "./enhanced-bot";

// Main execution
async function main(): Promise<void> {
  console.log("Start main");
  const bot = new EnhancedAIWordleBot();
  console.log("Bot in");

  try {
    // Play a single daily game
    await bot.playGame("daily");

    // Uncomment to play multiple random games
    // await bot.playMultipleGames(3, 'random');

    // Display analytics
    console.log("\n📈 PERFORMANCE ANALYTICS");
    console.log("========================");
    const analytics = bot.getAnalytics();
    console.log(JSON.stringify(analytics, null, 2));
  } catch (error) {
    console.error(
      "❌ Bot execution failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Run the bot if this file is executed directly
if (require.main === module) {
  main();
}
