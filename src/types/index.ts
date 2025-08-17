// API Response Types
export interface GuessResult {
  slot: number;
  guess: string;
  result: ResultKind;
}

export type ResultKind = "absent" | "present" | "correct";

export interface HTTPValidationError {
  detail: ValidationError[];
}

export interface ValidationError {
  loc: string[];
  msg: string;
  type: string;
}

// Game Types
export type GameType = "daily" | "random" | "word";

export interface GameData {
  id: number;
  type: GameType;
  size: number;
  seed?: number | undefined;
  startTime: Date;
  endTime?: Date | undefined;
  duration?: number | undefined;
  guesses: string[];
  results: GuessResult[][];
  success: boolean;
  attempts: number;
  error?: string | undefined;
}

// Analysis Types
export interface GuessAnalysis {
  correct: Set<string>;
  present: Set<string>;
  absent: Set<string>;
  positions: Map<number, string>;
  letterCounts: Map<string, LetterCount>;
  constraints: string[];
}

export interface LetterCount {
  min: number;
  max: number | null;
}

export interface ScoredWord {
  word: string;
  score: number;
}

// Configuration Types
export interface APIConfig {
  baseURL: string;
  timeout: number;
  retries: number;
}

export interface GameConfig {
  wordLength: number;
  maxAttempts: number;
  delayBetweenGuesses: number;
  delayBetweenGames: number;
}

export interface LetterBonuses {
  commonStart: string[];
  commonEnd: string[];
  vowels: string[];
}

export interface ScoringWeights {
  letterFrequency: number;
  startBonus: number;
  vowelBonus: number;
  commonEndBonus: number;
}

export interface StrategyConfig {
  startingWords: string[];
  letterBonuses: LetterBonuses;
  scoring: ScoringWeights;
}

export interface LoggingConfig {
  level: string;
  showEmojis: boolean;
  showColors: boolean;
}

export interface BotConfig {
  api: APIConfig;
  game: GameConfig;
  strategy: StrategyConfig;
  logging: LoggingConfig;
}

// Statistics Types
export interface GameStats {
  total: number;
  wins: number;
  totalAttempts: number;
  games: GameData[];
}

export interface PerformanceAnalytics {
  totalGames: number;
  winRate: number;
  averageAttempts: number;
  averageGameTime: number;
  bestPerformance: number | null;
  worstPerformance: number;
}

// Bot Interface
export interface IWordleBot {
  playGame(
    gameType?: GameType,
    size?: number,
    seed?: number
  ): Promise<GameData>;
  playMultipleGames(count?: number, gameType?: GameType): Promise<void>;
  makeGuess(
    guess: string,
    gameType?: GameType,
    size?: number,
    seed?: number
  ): Promise<GuessResult[]>;
  getAnalytics(): PerformanceAnalytics;
}
