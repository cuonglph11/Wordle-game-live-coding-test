import { BotConfig } from "./types";

const config: BotConfig = {
  // API Configuration
  api: {
    baseURL: "https://wordle.votee.dev:8000",
    timeout: 10000,
    retries: 3,
    dictionary: {
      baseURL: "https://api.dictionaryapi.dev/api/v2/entries/en",
      fallbackBaseURL: "https://freedictionaryapi.com/api/v1/entries/en",
      batchSize: 5,
      delayBetweenBatches: 1000,
      timeout: 3000, // 3 seconds timeout for dictionary requests
      cache: {
        maxSize: 2000, // Store up to 2000 words
        ttl: 604800000, // 7 days in milliseconds
      },
    },
  },

  // Game Configuration
  game: {
    wordLength: 5,
    maxAttempts: 50,
    delayBetweenGuesses: 500, // milliseconds
    delayBetweenGames: 2000, // milliseconds
  },

  // Bot Strategy Configuration
  strategy: {
    // Common starting words (ordered by effectiveness)
    startingWords: [
      "STARE",
      "CRANE",
      "SLATE",
      "TRACE",
      "ADIEU",
      "AUDIO",
      "RAISE",
      "ARISE",
      "STARE",
      "CRANE",
      "SLATE",
      "TRACE",
      "ADIEU",
      "AUDIO",
      "RAISE",
      "ARISE",
      "STARE",
      "CRANE",
      "SLATE",
      "TRACE",
    ],

    // Letter frequency bonuses
    letterBonuses: {
      commonStart: ["S", "C", "T", "A", "R"],
      commonEnd: ["E", "R", "T", "Y", "N"],
      vowels: ["A", "E", "I", "O", "U"],
    },

    // Scoring weights
    scoring: {
      letterFrequency: 1,
      startBonus: 10,
      vowelBonus: 5,
      commonEndBonus: 3,
    },
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
    showEmojis: true,
    showColors: true,
  },
};

export default config;
