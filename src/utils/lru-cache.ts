/**
 * LRU (Least Recently Used) Cache implementation with TTL support
 */
export class LRUCache<K, V> {
  private cache: Map<K, { value: V; expiry: number }>;
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(maxSize: number, ttlMs: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  /**
   * Get a value from the cache. Returns undefined if not found or expired.
   */
  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // Check if item has expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to front by removing and re-adding
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: K, value: V): void {
    // If key exists, remove it to update its position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    // Remove oldest item if at capacity
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // Add new item
    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl,
    });
  }

  /**
   * Clear all items from the cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries from the cache
   */
  cleanExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}
