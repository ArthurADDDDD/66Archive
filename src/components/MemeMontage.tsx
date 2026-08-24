import Link from 'next/link'
import type { MontageSample } from '@/lib/narrative'
import { AutoScrollText } from './AutoScrollText'

export function MemeMontage({
  title,
  description,
  href,
  linkLabel,
  samples,
}: {
  title: string
  description: string
  href: string
  linkLabel: string
  samples: MontageSample[]
}) {
  if (samples.length === 0) return null

  return (
    <div className="mt-7 border-y border-line/60 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-h3 font-medium text-ink">{title}</p>
          <p className="measure-body mt-2 text-meta leading-relaxed text-muted">{description}</p>
        </div>
        <Link href={href} className="ui-press rounded-sm text-meta text-live underline underline-offset-4">
          {linkLabel} →
        </Link>
      </div>

      <div className="mt-5 overflow-x-auto" aria-label={`${title}视频列表`}>
        <div className="flex gap-3 pb-1">
          {samples.map((sample) => (
            <Link key={sample.id} href={`/e/${sample.id}/`} className="group w-[clamp(10.5rem,18vw,15rem)] shrink-0">
              <div className="aspect-video overflow-hidden rounded-lg border border-line/60 bg-raised">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.cover}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                />
              </div>
              <AutoScrollText className="mt-1.5 text-meta text-faint tnum">{`${sample.date} · ${sample.title}`}</AutoScrollText>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
