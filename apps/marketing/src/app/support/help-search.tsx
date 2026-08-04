'use client';

import { Input } from '@icb/ui';
import { Search, SearchX } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import type { HelpArticle } from '@/content/help';

function matches(article: HelpArticle, query: string): boolean {
  const haystack = [article.title, article.summary, article.category, ...article.keywords]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/**
 * Client-side search over the help articles.
 *
 * The corpus is small and static, so filtering in the browser is instant and needs no API.
 * The results count is announced via a polite live region so screen-reader users hear the
 * list change as they type.
 */
export function HelpSearch({ articles }: Readonly<{ articles: readonly HelpArticle[] }>) {
  const [query, setQuery] = useState('');
  const inputId = useId();

  const results = useMemo(
    () => (query.trim() ? articles.filter((article) => matches(article, query)) : []),
    [articles, query],
  );

  const searching = query.trim().length > 0;
  const noun = results.length === 1 ? 'article' : 'articles';
  const statusText = searching
    ? `${results.length} ${noun} found`
    : `${articles.length} articles — type to filter`;

  return (
    <div>
      <div className="relative max-w-xl">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--icb-text-subtle)]"
        />
        <label htmlFor={inputId} className="sr-only">
          Search help articles
        </label>
        <Input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search — transfers, cards, statements…"
          autoComplete="off"
          className="pl-10"
        />
      </div>

      <p aria-live="polite" className="mt-3 text-sm text-[var(--icb-text-subtle)]">
        {statusText}
      </p>

      {searching && results.length === 0 ? (
        <div className="mt-8 max-w-xl rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)] px-6 py-10 text-center">
          <SearchX size={24} aria-hidden="true" className="mx-auto text-[var(--icb-text-subtle)]" />
          <p className="mt-3 font-medium">Nothing matches &ldquo;{query.trim()}&rdquo;</p>
          <p className="mt-1 text-sm text-[var(--icb-text-muted)]">
            Try fewer or different words, or send us a secure message from the app — a person will
            answer.
          </p>
        </div>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {results.map((article) => (
            <li
              key={article.slug}
              className="rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)] p-5"
            >
              <p className="text-xs font-semibold tracking-[0.1em] text-[var(--icb-accent-text)] uppercase">
                {article.category}
              </p>
              <h3 className="mt-2 text-base font-semibold">{article.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                {article.summary}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
