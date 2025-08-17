import axios, { AxiosResponse } from "axios";
import config from "./config";
import {
  GuessResult,
  GameType,
  GameData,
  GuessAnalysis,
  ScoredWord,
  IWordleBot,
  PerformanceAnalytics,
  BotConfig,
} from "./types";
require("dotenv").config();

export class EnhancedAIWordleBot implements IWordleBot {
  public readonly config: BotConfig;
  private baseURL: string;
  private wordLength: number;
  private maxAttempts: number;
  private startingWords: string[];
  private letterFrequencies: Record<string, number>;
  private gameHistory: GameData[];

  constructor() {
    this.config = config;
    this.baseURL = config.api.baseURL;
    this.wordLength = config.game.wordLength;
    this.maxAttempts = config.game.maxAttempts;
    this.startingWords = config.strategy.startingWords;
    this.letterFrequencies = this.calculateLetterFrequencies();
    this.gameHistory = [];
  }

  // Calculate letter frequencies from a larger word list
  private calculateLetterFrequencies(): Record<string, number> {
    const freq: Record<string, number> = {};
    const allWords = this.startingWords.join("");

    for (let char of allWords) {
      freq[char] = (freq[char] || 0) + 1;
    }

    // Add bonus for common letters
    const commonLetters = ["E", "A", "R", "I", "O", "T", "N", "S", "L", "C"];
    commonLetters.forEach((letter, index) => {
      if (freq[letter]) {
        freq[letter] += 10 - index; // Higher bonus for more common letters
      }
    });

    return freq;
  }

  // Enhanced word scoring with multiple factors
  public scoreWord(word: string, analysis?: GuessAnalysis): number {
    let score = 0;

    // Base letter frequency score
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      score += this.letterFrequencies[char] || 0;

      // Position-based bonuses
      if (
        i === 0 &&
        this.config.strategy.letterBonuses.commonStart.includes(char)
      ) {
        score += this.config.strategy.scoring.startBonus;
      }

      if (
        i === word.length - 1 &&
        this.config.strategy.letterBonuses.commonEnd.includes(char)
      ) {
        score += this.config.strategy.scoring.commonEndBonus;
      }

      // Vowel bonus
      if (this.config.strategy.letterBonuses.vowels.includes(char)) {
        score += this.config.strategy.scoring.vowelBonus;
      }
    }

    // Analysis-based scoring
    if (analysis) {
      // Bonus for words that could eliminate many possibilities
      const uniqueLetters = new Set(word);
      score += uniqueLetters.size * 2;

      // Penalty for repeating letters unnecessarily
      const letterCounts: Record<string, number> = {};
      for (let char of word) {
        letterCounts[char] = (letterCounts[char] || 0) + 1;
      }

      for (let char in letterCounts) {
        if (letterCounts[char] > 1) {
          score -= 5; // Penalty for repeated letters
        }
      }
    }

    return score;
  }

  // Get the best starting word
  private getBestStartingWord(): string {
    return this.startingWords.sort(
      (a: string, b: string) => this.scoreWord(b) - this.scoreWord(a)
    )[0];
  }

  // Enhanced analysis of guess results
  public analyzeResults(guess: string, results: GuessResult[]): GuessAnalysis {
    const analysis: GuessAnalysis = {
      correct: new Set<string>(),
      present: new Set<string>(),
      absent: new Set<string>(),
      positions: new Map<number, string>(),
      letterCounts: new Map<string, { min: number; max: number | null }>(),
      constraints: [],
    };

    // First pass: collect basic information
    results.forEach((result: GuessResult, index: number) => {
      const char = guess[index];
      const resultType = result.result;

      if (resultType === "correct") {
        analysis.correct.add(char);
        analysis.positions.set(index, char);
      } else if (resultType === "present") {
        analysis.present.add(char);
      } else if (resultType === "absent") {
        analysis.absent.add(char);
      }
    });

    // Second pass: build constraints
    const charResults: Record<
      string,
      { correct: number[]; present: number[]; absent: number[] }
    > = {};
    for (let i = 0; i < guess.length; i++) {
      const char = guess[i];
      if (!charResults[char]) {
        charResults[char] = { correct: [], present: [], absent: [] };
      }

      if (results[i].result === "correct") {
        charResults[char].correct.push(i);
      } else if (results[i].result === "present") {
        charResults[char].present.push(i);
      } else if (results[i].result === "absent") {
        charResults[char].absent.push(i);
      }
    }

    // Build constraints for each character
    for (let char in charResults) {
      const info = charResults[char];
      if (info.correct.length > 0 || info.present.length > 0) {
        // Character must appear at least this many times
        const minCount = info.correct.length + info.present.length;
        analysis.letterCounts.set(char, { min: minCount, max: null });
      }

      if (
        info.absent.length > 0 &&
        info.correct.length === 0 &&
        info.present.length === 0
      ) {
        // Character is completely absent
        analysis.letterCounts.set(char, { min: 0, max: 0 });
      }
    }

    return analysis;
  }

  // Enhanced word filtering with constraints
  public filterWords(
    analysis: GuessAnalysis,
    wordList: string[] = this.startingWords
  ): string[] {
    return wordList.filter((word: string) => {
      // Check absent letters
      for (let char of analysis.absent) {
        if (word.includes(char)) {
          return false;
        }
      }

      // Check correct positions
      for (let [pos, char] of analysis.positions) {
        if (word[pos] !== char) {
          return false;
        }
      }

      // Check letter count constraints
      for (let [char, counts] of analysis.letterCounts) {
        const wordCount = (word.match(new RegExp(char, "g")) || []).length;

        if (counts.min !== null && wordCount < counts.min) {
          return false;
        }

        if (counts.max !== null && wordCount > counts.max) {
          return false;
        }
      }

      // Check present letters (must be in word but not in wrong positions)
      for (let char of analysis.present) {
        if (!word.includes(char)) {
          return false;
        }

        // Check if it's in a position we know is wrong
        for (let i = 0; i < word.length; i++) {
          if (
            word[i] === char &&
            analysis.positions.has(i) &&
            analysis.positions.get(i) !== char
          ) {
            return false;
          }
        }
      }

      return true;
    });
  }

  // Generate next guess with enhanced strategy
  private generateNextGuess(
    analysis: GuessAnalysis,
    previousGuesses: string[]
  ): string {
    const filteredWords = this.filterWords(analysis);

    if (filteredWords.length === 0) {
      console.log("⚠️  No valid words found, using fallback strategy");
      return this.getBestStartingWord();
    }

    // Score remaining words
    const scoredWords: ScoredWord[] = filteredWords.map((word: string) => ({
      word,
      score: this.scoreWord(word, analysis),
    }));

    scoredWords.sort((a: ScoredWord, b: ScoredWord) => b.score - a.score);

    // Avoid repeating previous guesses
    for (let { word } of scoredWords) {
      if (!previousGuesses.includes(word)) {
        return word;
      }
    }

    // If all words were used, pick the highest scoring one
    return scoredWords[0].word;
  }

  // Enhanced API call with retry logic
  public async makeGuess(
    guess: string,
    gameType: GameType = "daily",
    size: number = 5,
    seed?: number
  ): Promise<GuessResult[]> {
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= this.config.api.retries; attempt++) {
      try {
        let url = `${this.baseURL}/${gameType}`;
        const params: Record<string, string | number> = { guess, size };

        if (seed && gameType === "random") {
          params.seed = seed;
        }

        const response: AxiosResponse<GuessResult[]> = await axios.get(url, {
          params,
          timeout: this.config.api.timeout,
        });

        return response.data;
      } catch (error) {
        lastError = error;
        console.warn(
          `⚠️  API attempt ${attempt} failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );

        if (attempt < this.config.api.retries) {
          await this.delay(1000 * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(
      `API call failed after ${this.config.api.retries} attempts: ${
        lastError instanceof Error ? lastError.message : "Unknown error"
      }`
    );
  }

  // Enhanced game playing with better logging
  public async playGame(
    gameType: GameType = "daily",
    size: number = 5,
    seed?: number
  ): Promise<GameData> {
    const gameId = Date.now();
    console.log(
      `\n🎯 Starting Game #${gameId} - ${gameType.toUpperCase()} (${size} letters)`
    );
    if (seed) console.log(`🌱 Using seed: ${seed}`);

    const gameData: GameData = {
      id: gameId,
      type: gameType,
      size,
      seed: seed || undefined,
      startTime: new Date(),
      guesses: [],
      results: [],
      success: false,
      attempts: 0,
    };

    let currentGuess = this.getBestStartingWord();

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      console.log(
        `\n📝 Attempt ${attempt}/${this.maxAttempts}: ${currentGuess}`
      );

      try {
        const result = await this.makeGuess(currentGuess, gameType, size, seed);
        gameData.results.push(result);
        gameData.guesses.push(currentGuess);
        gameData.attempts = attempt;

        // Display results
        this.displayResults(currentGuess, result);

        // Check win condition
        if (this.checkWin(result)) {
          gameData.success = true;
          gameData.endTime = new Date();
          gameData.duration =
            gameData.endTime.getTime() - gameData.startTime.getTime();

          console.log(`\n🎉 SUCCESS! Word found in ${attempt} attempts!`);
          console.log(
            `⏱️  Time taken: ${(gameData.duration / 1000).toFixed(1)}s`
          );

          this.gameHistory.push(gameData);
          return gameData;
        }

        // Generate next guess
        const analysis = this.analyzeResults(currentGuess, result);
        const filteredWords = this.filterWords(analysis);

        if (filteredWords.length === 0) {
          console.log("⚠️  No valid words found based on results");
          break;
        }

        console.log(`🔍 Found ${filteredWords.length} possible words`);
        currentGuess = this.generateNextGuess(analysis, gameData.guesses);

        // Delay between guesses
        await this.delay(this.config.game.delayBetweenGuesses);
      } catch (error) {
        console.error(
          `❌ Error on attempt ${attempt}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        gameData.error =
          error instanceof Error ? error.message : "Unknown error";
        break;
      }
    }

    // Game over
    gameData.endTime = new Date();
    gameData.duration =
      gameData.endTime.getTime() - gameData.startTime.getTime();

    console.log(`\n💀 Game over! Maximum attempts reached.`);
    console.log(`⏱️  Time taken: ${(gameData.duration / 1000).toFixed(1)}s`);

    this.gameHistory.push(gameData);
    return gameData;
  }

  // Enhanced results display
  private displayResults(guess: string, results: GuessResult[]): void {
    let display = "";
    for (let i = 0; i < guess.length; i++) {
      const char = guess[i];
      const result = results[i];

      switch (result.result) {
        case "correct":
          display += `🟩${char}`;
          break;
        case "present":
          display += `🟨${char}`;
          break;
        case "absent":
          display += `⬜${char}`;
          break;
        default:
          display += `❓${char}`;
      }
    }
    console.log(display);
  }

  // Check win condition
  private checkWin(results: GuessResult[]): boolean {
    return results.every((result) => result.result === "correct");
  }

  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Play multiple games with enhanced statistics
  public async playMultipleGames(
    count: number = 5,
    gameType: GameType = "random"
  ): Promise<void> {
    console.log(`\n🚀 Playing ${count} ${gameType} games...`);

    const startTime = Date.now();

    for (let i = 1; i <= count; i++) {
      console.log(`\n--- Game ${i}/${count} ---`);
      await this.playGame(gameType, this.wordLength);

      // Delay between games
      if (i < count) {
        console.log("⏳ Waiting before next game...");
        await this.delay(this.config.game.delayBetweenGames);
      }
    }

    const totalTime = Date.now() - startTime;
    this.displayEnhancedStats(count, totalTime);
  }

  // Enhanced statistics display
  private displayEnhancedStats(gameCount: number, totalTime: number): void {
    const successfulGames = this.gameHistory.filter((g) => g.success);

    console.log("\n📊 ENHANCED GAME STATISTICS");
    console.log("=============================");
    console.log(`Total Games: ${gameCount}`);
    console.log(`Wins: ${successfulGames.length}`);
    console.log(`Losses: ${gameCount - successfulGames.length}`);
    console.log(
      `Win Rate: ${((successfulGames.length / gameCount) * 100).toFixed(1)}%`
    );
    console.log(`Total Time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(
      `Average Time per Game: ${(totalTime / gameCount / 1000).toFixed(1)}s`
    );

    if (successfulGames.length > 0) {
      const avgAttempts =
        successfulGames.reduce((sum, g) => sum + g.attempts, 0) /
        successfulGames.length;
      console.log(`Average Attempts (Wins): ${avgAttempts.toFixed(1)}`);

      const fastestWin = Math.min(
        ...successfulGames.map((g) => g.duration || 0)
      );
      console.log(`Fastest Win: ${(fastestWin / 1000).toFixed(1)}s`);
    }

    console.log("\nGame Results:");
    this.gameHistory.slice(-gameCount).forEach((game, index) => {
      const status = game.success ? "✅" : "❌";
      const time = game.duration ? (game.duration / 1000).toFixed(1) : "0.0";
      console.log(
        `Game ${index + 1}: ${status} ${game.attempts} attempts (${time}s)`
      );
    });
  }

  // Get performance analytics
  public getAnalytics(): PerformanceAnalytics {
    if (this.gameHistory.length === 0) {
      return {
        totalGames: 0,
        winRate: 0,
        averageAttempts: 0,
        averageGameTime: 0,
        bestPerformance: null,
        worstPerformance: 0,
      };
    }

    const successfulGames = this.gameHistory.filter((g) => g.success);

    return {
      totalGames: this.gameHistory.length,
      winRate: (successfulGames.length / this.gameHistory.length) * 100,
      averageAttempts:
        successfulGames.length > 0
          ? successfulGames.reduce((sum, g) => sum + g.attempts, 0) /
            successfulGames.length
          : 0,
      averageGameTime:
        this.gameHistory.reduce((sum, g) => sum + (g.duration || 0), 0) /
        this.gameHistory.length,
      bestPerformance:
        successfulGames.length > 0
          ? Math.min(...successfulGames.map((g) => g.attempts))
          : null,
      worstPerformance: Math.max(...this.gameHistory.map((g) => g.attempts)),
    };
  }
}
