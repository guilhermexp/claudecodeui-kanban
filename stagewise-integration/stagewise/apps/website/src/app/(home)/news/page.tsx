import { news } from '@/lib/source';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Newsroom | stagewise',
  description:
    "Find out what we're up to, what we're thinking, and what we're doing at stagewise",
  openGraph: {
    title: 'Newsroom | stagewise',
    description:
      "Find out what we're up to, what we're thinking, and what we're doing at stagewise",
    type: 'website',
  },
  twitter: {
    title: 'Newsroom | stagewise',
    description:
      "Find out what we're up to, what we're thinking, and what we're doing at stagewise",
    creator: '@stagewise_io',
  },
  category: 'technology',
};

export default function BlogPage() {
  const posts = news.getPages();

  return (
    <div className="flex w-full max-w-2xl flex-col gap-12 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="bg-gradient-to-tr from-zinc-900 via-zinc-700 to-black bg-clip-text font-bold text-3xl text-transparent tracking-tight md:text-5xl dark:from-zinc-100 dark:via-zinc-300 dark:to-white">
          Newsroom
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          Find out what we're up to, what we're thinking, and what we're doing
          at stagewise.
        </p>
        <div className="flex flex-row gap-4">
          <Link
            href="https://www.ycombinator.com/companies/stagewise"
            target="_blank"
            aria-label="Y Combinator page of stagewise"
            className="flex size-6 items-center justify-center rounded-sm bg-[#F26625] text-sm text-white ring-1 ring-zinc-500/30 hover:opacity-80"
          >
            Y
          </Link>
          <Link
            href="https://www.linkedin.com/company/stagewise-io"
            target="_blank"
            aria-label="LinkedIn page of stagewise"
            className="] flex size-6 items-center justify-center rounded-sm bg-[#0b66c2] font-bold text-sm text-white ring-1 ring-zinc-500/30 hover:opacity-80"
          >
            in
          </Link>
          <Link
            href="https://x.com/stagewise_io"
            target="_blank"
            aria-label="X page of stagewise"
            className="flex size-6 items-center justify-center rounded-sm bg-black text-sm text-white ring-1 ring-zinc-500/30 hover:opacity-80"
          >
            𝕏
          </Link>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        {posts
          .sort(
            (a, b) =>
              new Date(b.data.date).getTime() - new Date(a.data.date).getTime(),
          )
          .map((post) => (
            <Link href={post.url} key={post.path}>
              <div className="flex w-full flex-col items-start justify-center gap-1 rounded-xl border border-zinc-500/20 bg-white p-4 shadow-md dark:bg-zinc-900">
                <p className="font-semibold text-xl text-zinc-900 tracking-tight dark:text-white">
                  {post.data.title}
                </p>
                <span className="text-base text-zinc-600 dark:text-zinc-400">
                  {post.data.description}
                </span>
                <div className="mt-1 flex w-full flex-row items-end justify-end gap-6">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {post.data.date.toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
