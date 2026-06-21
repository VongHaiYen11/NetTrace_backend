export class TtlMapCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const normalizedKey = key.toLowerCase();
    const entry = this.entries.get(normalizedKey);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(normalizedKey);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T) {
    this.entries.set(key.toLowerCase(), {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear() {
    this.entries.clear();
  }
}
