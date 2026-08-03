/**
 * A keyed mutex: work touching the same key runs one at a time, different keys run in parallel.
 *
 * Postings to a single account are inherently serial — every one of them reads and writes the
 * same balance document, so MongoDB will make them take turns whatever the application does.
 * The only question is *how*. Optimistic retry makes them collide, back off, and repeat the work;
 * under a payday burst that means most of the effort is wasted and, once the retry budget runs
 * out, postings are dropped outright.
 *
 * Queueing does the same work once. Throughput on one account is unchanged (it was always
 * serial), throughput across accounts is unaffected, and nothing is discarded.
 *
 * Scope: this is per-process. Two API instances would still contend at the database, where the
 * retry loop in TransactionManager remains the backstop. A multi-instance deployment wanting the
 * same guarantee needs a distributed lock — Redis is already a dependency for it.
 */

interface Queue {
  /** Resolves when the current holder releases. */
  tail: Promise<void>;
  /** Holders plus waiters. The entry is dropped when this reaches zero. */
  depth: number;
}

export class KeyedMutex {
  private readonly queues = new Map<string, Queue>();

  /**
   * Run `work` while holding every key exclusively.
   *
   * Keys are acquired in sorted order, so two callers wanting the same pair can never take them
   * in opposite orders and deadlock.
   */
  async withKeys<T>(keys: readonly string[], work: () => Promise<T>): Promise<T> {
    const ordered = [...new Set(keys)].sort((left, right) => (left < right ? -1 : 1));

    if (ordered.length === 0) {
      return work();
    }

    const releases: (() => void)[] = [];

    try {
      for (const key of ordered) {
        releases.push(await this.acquire(key));
      }

      return await work();
    } finally {
      // Reverse order, so the queues unwind the way they were built.
      for (const release of releases.toReversed()) {
        release();
      }
    }
  }

  /** Keys currently held or waited on. Exposed for health reporting and tests. */
  get activeKeys(): number {
    return this.queues.size;
  }

  private async acquire(key: string): Promise<() => void> {
    const queue = this.queues.get(key);
    const ahead = queue?.tail ?? Promise.resolve();

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    // The new tail is "after everyone ahead of me, and after I release".
    this.queues.set(key, {
      tail: ahead.then(() => held),
      depth: (queue?.depth ?? 0) + 1,
    });

    await ahead;

    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      release();

      const current = this.queues.get(key);
      if (current === undefined) {
        return;
      }
      current.depth -= 1;
      if (current.depth === 0) {
        this.queues.delete(key);
      }
    };
  }
}
