const { EnhancedAIWordleBot } = require("./dist/enhanced-bot");

async function debug() {
  console.log("Creating bot...");
  const bot = new EnhancedAIWordleBot();
  
  console.log("Dictionary service:", bot.dictionaryService ? "exists" : "missing");
  
  // Mock the dictionary service
  const mockDictionaryService = {
    isValidWord: async () => true,
    validateWords: async (words) => {
      console.log("validateWords called with:", words);
      return ["SALTY", "SPASM", "SHARD"];
    },
  };
  
  bot.dictionaryService = mockDictionaryService;
  
  console.log("Dictionary service after mock:", bot.dictionaryService ? "exists" : "missing");
  
  const analysis = {
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
  
  try {
    console.log("Calling generateNextGuess...");
    const result = await bot.generateNextGuess(analysis, ["ARISE"]);
    console.log("Result:", result);
  } catch (error) {
    console.log("Error:", error.message);
    console.log("Stack:", error.stack);
  }
}

debug();