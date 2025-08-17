import { BotConfig } from "./types";

const config: BotConfig = {
  // API Configuration
  api: {
    baseURL: "https://wordle.votee.dev:8000",
    timeout: 10000,
    retries: 3,
  },

  // Game Configuration
  game: {
    wordLength: 5,
    maxAttempts: 6,
    delayBetweenGuesses: 1000, // milliseconds
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
