import axios, { AxiosResponse } from "axios";
import config from "./config";
import {
  FreeDictionaryService,
  DictionaryService,
} from "./services/dictionary";
import {
  GuessResult,
  GameType,
  GameData,
  GuessAnalysis,
  ScoredWord,
  IWordleBot,
  PerformanceAnalytics,
  BotConfig,
  NormalizedConstraints,
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
  private dictionaryService: DictionaryService;
  private positionFrequencies: Map<number, Record<string, number>>;

  // Initialize position-specific letter frequencies
  private initPositionFrequencies(): Map<number, Record<string, number>> {
    const posFreq = new Map<number, Record<string, number>>();
    for (let i = 0; i < this.wordLength; i++) {
      const freq: Record<string, number> = {};
      this.startingWords.forEach((word) => {
        freq[word[i]] = (freq[word[i]] || 0) + 1;
      });
      posFreq.set(i, freq);
    }
    return posFreq;
  }

  // Normalize and validate constraints from analysis
  private normalizeConstraints(analysis: GuessAnalysis): NormalizedConstraints {
    const greens = new Array(this.wordLength).fill(null);
    const minCounts: Record<string, number> = {};
    const maxCounts: Partial<Record<string, number>> = {};
    const bannedPos: Record<string, Set<number>> = {};
    const forbidden = new Set<string>();
    const testedLetters = new Set<string>();

    // Process greens first to establish baseline counts
    analysis.positions.forEach((char, pos) => {
      greens[pos] = char;
      minCounts[char] = (minCounts[char] || 0) + 1;
      testedLetters.add(char);
    });

    // Process present letters (yellows)
    analysis.present.forEach((char) => {
      minCounts[char] = Math.max(
        (minCounts[char] || 0) + 1,
        Array.from(analysis.positions.entries()).filter(([_, c]) => c === char)
          .length
      );

      if (!bannedPos[char]) {
        bannedPos[char] = new Set<number>();
      }

      // Find positions where this yellow letter appeared and was incorrect
      for (let i = 0; i < this.wordLength; i++) {
        if (greens[i] !== char && analysis.positions.get(i) !== char) {
          bannedPos[char].add(i);
        }
      }

      testedLetters.add(char);
    });

    // Process absent letters and determine max counts
    analysis.absent.forEach((char) => {
      if (!minCounts[char]) {
        forbidden.add(char);
      } else {
        // If we see an absent for a letter we know exists,
        // we can set its exact count as the current minimum
        maxCounts[char] = minCounts[char];
      }
      testedLetters.add(char);
    });

    // Validate for impossible constraints
    Object.entries(maxCounts).forEach(([char, max]) => {
      const min = minCounts[char] || 0;
      if (max !== undefined && min > max) {
        throw new Error(
          `Impossible constraints for letter ${char}: min=${min}, max=${max}`
        );
      }
    });

    return {
      greens,
      minCounts,
      maxCounts,
      bannedPos,
      forbidden,
      testedLetters,
    };
  }

  constructor() {
    this.config = config;
    this.baseURL = config.api.baseURL;
    this.wordLength = config.game.wordLength;
    this.maxAttempts = config.game.maxAttempts;
    this.startingWords = config.strategy.startingWords;
    this.letterFrequencies = this.calculateLetterFrequencies();
    this.gameHistory = [];
    this.dictionaryService = new FreeDictionaryService();
    this.positionFrequencies = this.initPositionFrequencies();
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
  public scoreWord(
    word: string,
    analysis?: GuessAnalysis,
    candidates?: string[]
  ): number {
    let score = 0;
    const letterCounts: Record<string, number> = {};
    const uniqueLetters = new Set(word);

    // Count letters
    for (let char of word) {
      letterCounts[char] = (letterCounts[char] || 0) + 1;
    }

    // Position-specific and frequency scoring
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const positionScore = this.positionFrequencies.get(i)?.[char] || 0;

      // Base position and frequency score
      score += positionScore * 2;
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

      // Vowel bonus (weighted by position)
      if (this.config.strategy.letterBonuses.vowels.includes(char)) {
        score +=
          this.config.strategy.scoring.vowelBonus *
          (i === 1 || i === 2 ? 1.5 : 1);
      }
    }

    // Handle constraints and duplicate letters
    if (analysis) {
      const constraints = this.normalizeConstraints(analysis);

      // Reward letters we haven't tested yet
      for (let char of uniqueLetters) {
        if (!constraints.testedLetters.has(char)) {
          score += 8;
        }
      }

      // Smart duplicate handling
      for (const [char, count] of Object.entries(letterCounts)) {
        const minRequired = constraints.minCounts[char] || 0;
        const maxAllowed = constraints.maxCounts[char];

        if (count > 1) {
          if (minRequired >= count) {
            // Necessary duplicates - small bonus
            score += 2;
          } else {
            // Unnecessary duplicates - penalty scaled by excess
            score -= 5 * (count - (minRequired || 1));
          }
        }

        // Penalize going over known max
        if (maxAllowed !== undefined && count > maxAllowed) {
          score -= 10 * (count - maxAllowed);
        }
      }
    }

    // Information theory scoring when we have candidates
    if (candidates?.length) {
      if (candidates.length <= 20) {
        // For small candidate sets, prefer words that could be the answer
        score += candidates.includes(word) ? 15 : 0;
      } else {
        // For larger sets, calculate entropy contribution
        const entropy = this.entropyOf(word, candidates);
        score += entropy * 10; // Weight entropy heavily
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

    // Initialize banned positions record
    const bannedPos: Record<string, Set<number>> = {};

    // First pass: collect basic information and positions
    results.forEach((result: GuessResult, index: number) => {
      const char = guess[index];
      const resultType = result.result;

      if (resultType === "correct") {
        analysis.correct.add(char);
        analysis.positions.set(index, char);
      } else if (resultType === "present") {
        analysis.present.add(char);
        if (!analysis.letterCounts.has(char)) {
          analysis.letterCounts.set(char, { min: 1, max: null });
        }
        // Track positions where yellow letters appeared (to avoid these positions)
        if (!bannedPos[char]) bannedPos[char] = new Set<number>();
        bannedPos[char].add(index);
      } else if (resultType === "absent") {
        if (!analysis.correct.has(char) && !analysis.present.has(char)) {
          analysis.absent.add(char);
        } else {
          // If letter is absent but we've seen it in correct/present,
          // we know the exact count of this letter
          const knownCount = Array.from(results).filter(
            (r, i) =>
              guess[i] === char &&
              (r.result === "correct" || r.result === "present")
          ).length;
          analysis.letterCounts.set(char, { min: knownCount, max: knownCount });
        }
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
  public async filterWords(
    analysis: GuessAnalysis,
    wordList: string[] = this.startingWords
  ): Promise<string[]> {
    const constraints = this.normalizeConstraints(analysis);

    // First filter with our standard rules
    let filteredWords = wordList.filter((word: string) => {
      // Check forbidden letters
      for (let char of constraints.forbidden) {
        if (word.includes(char)) {
          return false;
        }
      }

      // Check green letters (correct positions)
      for (let i = 0; i < word.length; i++) {
        if (
          constraints.greens[i] !== null &&
          word[i] !== constraints.greens[i]
        ) {
          return false;
        }
      }

      // Check minimum letter counts
      for (const [char, minCount] of Object.entries(constraints.minCounts)) {
        const wordCount = (word.match(new RegExp(char, "g")) || []).length;
        if (wordCount < minCount) {
          return false;
        }
      }

      // Check maximum letter counts
      for (const [char, maxCount] of Object.entries(constraints.maxCounts)) {
        const wordCount = (word.match(new RegExp(char, "g")) || []).length;
        if (maxCount !== undefined && wordCount > maxCount) {
          return false;
        }
      }

      // Check banned positions for yellow letters
      for (const [char, positions] of Object.entries(constraints.bannedPos)) {
        for (const pos of positions) {
          if (word[pos] === char) {
            return false;
          }
        }
      }

      return true;
    });

    // Validate against dictionary
    filteredWords = await this.dictionaryService.validateWords(filteredWords);

    // If no matches found in our known word list, try generating new combinations
    if (filteredWords.length === 0) {
      const pattern = new Array(this.wordLength).fill("");
      for (let [pos, char] of analysis.positions) {
        pattern[pos] = char;
      }

      const candidates = await this.generateAndValidateWords(pattern, analysis);
      return candidates;
    }

    // For known words, just return them as they are pre-validated
    return filteredWords;
  }

  // Generate possible words and validate them against dictionary
  private async generateWordCombinations(
    pattern: string[],
    analysis: GuessAnalysis
  ): Promise<string[]> {
    const possibleWords: string[] = [];
    const vowels = new Set(["A", "E", "I", "O", "U"]);
    const consonants = new Set(Array.from("BCDFGHJKLMNPQRSTVWXYZ"));

    // Helper to check if a word is valid according to our rules
    const isValidCandidate = (word: string): boolean => {
      // Check the generated word contains the known letters in the right positions
      for (let [pos, char] of analysis.positions) {
        if (word[pos] !== char) return false;
      }

      // Remove the word if it does not contain the present letters
      for (let char of analysis.present) {
        if (!word.includes(char)) return false;
      }

      for (let char of analysis.absent) {
        if (word.includes(char)) return false;
      }

      // Ensure word has at least one vowel
      if (!Array.from(word).some((c) => vowels.has(c))) return false;

      return true;
    };

    // Common English word patterns
    const patterns = [
      "CVCVC", // like "PAPER"
      "CCVCV", // like "BREAK"
      "CVCCV", // like "PASTA"
      "CVCCC", // like "NIGHT"
      "CCVCC", // like "BREAK"
    ];

    for (const wordPattern of patterns) {
      let word = "";
      for (let i = 0; i < this.wordLength; i++) {
        if (pattern[i]) {
          // Use known letter from the pattern
          word += pattern[i];
        } else {
          // Use letters based on the word pattern (C=consonant, V=vowel)
          const isVowelPosition = wordPattern[i] === "V";
          const letterPool = Array.from(
            isVowelPosition ? vowels : consonants
          ).filter((c) => !analysis.absent.has(c));

          if (letterPool.length > 0) {
            // Choose letter based on frequency
            const letter = letterPool.sort(
              (a, b) =>
                (this.letterFrequencies[b] || 0) -
                (this.letterFrequencies[a] || 0)
            )[0];
            word += letter;
          }
        }
      }

      const isValid = isValidCandidate(word);

      if (word.length === this.wordLength && isValid) {
        possibleWords.push(word);
      }
    }

    // Validate words with the dictionary API
    return await this.dictionaryService.validateWords(possibleWords);
  }

  // Generate next guess using hybrid entropy/minimax strategy
  private async generateNextGuess(
    analysis: GuessAnalysis,
    previousGuesses: string[],
    candidates?: string[]
  ): Promise<string> {
    // If candidates not provided, try to generate them
    let remainingWords = candidates;
    if (!remainingWords) {
      remainingWords = await this.filterWords(analysis);
    }

    if (remainingWords.length === 0) {
      console.log("⚠️  No valid words found, using beam search fallback");
      // Try beam search to generate new candidates
      const beamCandidates = await this.enumerateCandidates(300);

      // Helper to verify a candidate satisfies current analysis constraints
      const matchesAnalysis = (word: string): boolean => {
        // Must include all present letters
        for (const p of analysis.present) {
          if (!word.includes(p)) return false;
        }
        // Must not include absent letters (unless that letter is also marked present/correct elsewhere)
        for (const a of analysis.absent) {
          if (
            !analysis.present.has(a) &&
            !analysis.correct.has(a) &&
            word.includes(a)
          ) {
            return false;
          }
        }
        // Greens (positions map) must match
        for (const [pos, ch] of analysis.positions) {
          if (word[pos] !== ch) return false;
        }
        // Letter count minimums
        for (const [ch, { min, max }] of analysis.letterCounts.entries()) {
          const count = (word.match(new RegExp(ch, "g")) || []).length;
          if (count < min) return false;
          if (max !== null && max !== null && max !== undefined && count > max)
            return false;
        }
        return true;
      };

      const validBeam = beamCandidates.filter(
        (word) => !previousGuesses.includes(word) && matchesAnalysis(word)
      );

      if (validBeam.length > 0) {
        // Score remaining validBeam candidates to pick the best informative one
        const scored = validBeam.map((w) => ({
          word: w,
          score: this.scoreWord(w, analysis, validBeam),
        }));
        scored.sort((a, b) => b.score - a.score);
        return scored[0].word;
      }

      // As a last resort, fall back to any beam candidate that at least contains all present letters
      const looseFallback = beamCandidates.filter(
        (w) =>
          !previousGuesses.includes(w) &&
          Array.from(analysis.present).every((p) => w.includes(p)) &&
          Array.from(analysis.absent).every(
            (a) =>
              analysis.present.has(a) ||
              analysis.correct.has(a) ||
              !w.includes(a)
          )
      );
      if (looseFallback.length > 0) {
        looseFallback.sort(
          (a, b) =>
            this.scoreWord(b, analysis, looseFallback) -
            this.scoreWord(a, analysis, looseFallback)
        );
        return looseFallback[0];
      }

      // If we truly cannot satisfy constraints, return the best starting word to gather new info
      return this.getBestStartingWord();
    }

    // Get all possible words that meet our constraints to use as a corpus
    const allAvailableWords = await this.enumerateCandidates(500);
    const availableWords = allAvailableWords.filter(
      (word) => !previousGuesses.includes(word)
    );

    // Enhanced strategy based on remaining word count
    // For very small candidate sets (endgame), just pick from the candidates
    if (remainingWords.length <= 2) {
      console.log(`🎯 Endgame strategy (${remainingWords.length} candidates)`);
      // Simply guess from the remaining possibilities
      const nonPreviousGuesses = remainingWords.filter(
        (word) => !previousGuesses.includes(word)
      );
      if (nonPreviousGuesses.length > 0) {
        return nonPreviousGuesses[0];
      }
    }

    // For small candidate sets (late game), use minimax strategy
    else if (remainingWords.length <= 20) {
      console.log(
        `🎯 Using minimax strategy (${remainingWords.length} candidates)`
      );
      const minimaxScores = new Map<string, number>();

      // Score each candidate by worst-case bucket size
      for (const word of availableWords) {
        if (!previousGuesses.includes(word)) {
          const worstCase = this.worstCaseBucket(word, remainingWords);
          minimaxScores.set(word, worstCase);
        }
      }

      // Sort by minimax score (ascending - smaller buckets are better)
      const sortedByMinimax = Array.from(minimaxScores.entries()).sort(
        ([, a], [, b]) => a - b
      );

      if (sortedByMinimax.length > 0) {
        // If we have multiple options with same worst case, tiebreak by entropy
        const bestScore = sortedByMinimax[0][1];
        const tiedForBest = sortedByMinimax
          .filter(([, score]) => score === bestScore)
          .map(([word]) => word);

        if (tiedForBest.length > 1) {
          // Break ties with weighted entropy and frequency
          return tiedForBest
            .map((word) => {
              const entropyScore = this.entropyOf(word, remainingWords);
              const frequencyScore = this.scoreWord(
                word,
                analysis,
                remainingWords
              );
              return {
                word,
                score: entropyScore * 0.7 + frequencyScore * 0.3,
              };
            })
            .sort((a, b) => b.score - a.score)[0].word;
        }

        return sortedByMinimax[0][0];
      }
    }

    // For larger sets (early/mid game), use entropy-based scoring with weighted frequency
    console.log(
      `🔍 Using enhanced entropy strategy (${remainingWords.length} candidates)`
    );

    // Limit candidates for performance
    const candidateLimit = Math.min(
      remainingWords.length > 50 ? 200 : 100,
      availableWords.length
    );
    const topCandidates = availableWords.slice(0, candidateLimit);

    // Score candidates using combined entropy and frequency
    const scoredWords: ScoredWord[] = topCandidates
      .filter((word) => !previousGuesses.includes(word))
      .map((word) => {
        const entropyScore = this.entropyOf(word, remainingWords);
        const frequencyScore = this.scoreWord(word, analysis, remainingWords);
        // Weight entropy more heavily for earlier guesses
        const entropyWeight = remainingWords.length > 50 ? 0.8 : 0.6;
        const combinedScore =
          entropyScore * entropyWeight + frequencyScore * (1 - entropyWeight);

        return {
          word,
          score: combinedScore,
        };
      });

    if (scoredWords.length === 0) {
      return this.getBestStartingWord();
    }

    // Return highest scoring candidate
    scoredWords.sort((a, b) => b.score - a.score);
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

  private async generateAndValidateWords(
    pattern: string[],
    analysis: GuessAnalysis
  ): Promise<string[]> {
    return this.generateWordCombinations(pattern, analysis);
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
        const nextGuess = await this.generateNextGuess(
          analysis,
          gameData.guesses
        );

        if (!nextGuess) {
          console.log("⚠️  No valid words found based on results");
          break;
        }

        currentGuess = nextGuess;
        console.log(`🔍 Next guess generated: ${currentGuess}`);

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
  private entropyOf(guess: string, secrets: string[]): number {
    const patterns = this.partitionByPattern(guess, secrets);
    let entropy = 0;

    const totalSize = secrets.length;
    for (const [_, bucket] of patterns) {
      const p = bucket.length / totalSize;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  private worstCaseBucket(guess: string, secrets: string[]): number {
    const patterns = this.partitionByPattern(guess, secrets);
    let maxSize = 0;

    for (const [_, bucket] of patterns) {
      maxSize = Math.max(maxSize, bucket.length);
    }

    return maxSize;
  }

  private partitionByPattern(
    guess: string,
    secrets: string[]
  ): Map<string, string[]> {
    const patterns = new Map<string, string[]>();

    for (const secret of secrets) {
      const pattern = this.computePattern(guess, secret);
      if (!patterns.has(pattern)) {
        patterns.set(pattern, []);
      }
      patterns.get(pattern)!.push(secret);
    }

    return patterns;
  }

  private computePattern(guess: string, secret: string): string {
    const result = new Array(guess.length).fill("⬜"); // Grey
    const secretLetters = new Map<string, number>();

    // Count letters in secret
    for (const char of secret) {
      secretLetters.set(char, (secretLetters.get(char) || 0) + 1);
    }

    // First pass: Mark correct positions (green)
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === secret[i]) {
        result[i] = "🟩"; // Green
        secretLetters.set(guess[i], (secretLetters.get(guess[i]) || 1) - 1);
      }
    }

    // Second pass: Mark present letters (yellow)
    for (let i = 0; i < guess.length; i++) {
      const count = secretLetters.get(guess[i]) || 0;
      if (result[i] === "⬜" && count > 0) {
        result[i] = "🟨"; // Yellow
        secretLetters.set(guess[i], count - 1);
      }
    }

    return result.join("");
  }

  // Beam search for candidate generation
  private async enumerateCandidates(limit: number): Promise<string[]> {
    const beamWidth = 100;
    const candidates: string[] = [];
    let beam: Array<{ partial: string; score: number }> = [
      { partial: "", score: 0 },
    ];

    // Helper to score partial words
    const scorePartial = (partial: string): number => {
      let score = 0;
      for (let i = 0; i < partial.length; i++) {
        const char = partial[i];
        score += (this.positionFrequencies.get(i)?.[char] || 0) * 2;
        score += this.letterFrequencies[char] || 0;
      }
      return score;
    };

    // Helper to check if partial word could lead to valid candidates
    const isPossiblePrefix = (partial: string): boolean => {
      // Must have a vowel by position 3 if none yet
      if (partial.length >= 3) {
        const hasVowel = Array.from(partial).some((c) =>
          this.config.strategy.letterBonuses.vowels.includes(c)
        );
        if (!hasVowel) return false;
      }

      // Avoid three consonants in a row unless at end
      const lastThree = partial.slice(-3);
      if (lastThree.length === 3) {
        const allConsonants = Array.from(lastThree).every(
          (c) => !this.config.strategy.letterBonuses.vowels.includes(c)
        );
        if (allConsonants && partial.length < this.wordLength) return false;
      }

      return true;
    };

    // For each position
    for (let pos = 0; pos < this.wordLength; pos++) {
      const nextBeam: Array<{ partial: string; score: number }> = [];

      // Try extending each partial word in beam
      for (const { partial } of beam) {
        // Get letter frequencies for this position
        const posFreq = this.positionFrequencies.get(pos) || {};

        // Try each possible next letter
        // @ts-ignore
        for (const [char, freq] of Object.entries(posFreq)) {
          const newPartial = partial + char;

          // Early pruning of unlikely candidates
          if (!isPossiblePrefix(newPartial)) continue;

          const score = scorePartial(newPartial);
          nextBeam.push({ partial: newPartial, score });
        }
      }

      // Keep top-k partial words
      beam = nextBeam.sort((a, b) => b.score - a.score).slice(0, beamWidth);
    }

    // Convert complete words to candidates
    candidates.push(...beam.map((x) => x.partial));

    // Validate candidates against dictionary
    const validCandidates = await this.dictionaryService.validateWords(
      candidates
    );
    return validCandidates.slice(0, limit);
  }

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
