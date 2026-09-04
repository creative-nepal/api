interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * A tiny per-process cache for values that change rarely and are read on
 * every request. Deliberately not Redis: these are small, per-tenant, and
 * cheap to recompute, so a short TTL plus explicit invalidation on write is
 * enough. A second API instance may serve a stale value for up to the TTL,
 * which is the trade being made.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
