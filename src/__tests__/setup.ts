// Test setup file for Jest
import "dotenv/config";

// Global test configuration
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = "test";
});

afterAll(() => {
  // Clean up after all tests
  jest.clearAllMocks();
});

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log during tests unless explicitly needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Add a dummy test to satisfy Jest requirement
describe("Test Setup", () => {
  test("should be properly configured", () => {
    expect(process.env.NODE_ENV).toBe("test");
  });
});
