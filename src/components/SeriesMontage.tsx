import Link from 'next/link'
import { proxyImage } from '@/lib/platforms'
import { AutoScrollText } from './AutoScrollText'

export type SeriesMontageSample = {
  id: string
  date: string
  title: string
  cover: string
}

export function SeriesMontage({ samples }: { samples: SeriesMontageSample[] }) {
  if (samples.length === 0) return null

  return (
    <div className="overflow-x-auto" aria-label="心灵砒霜最近录像">
      <div className="flex gap-3 pb-1">
        {samples.map((sample) => (
          <Link
            key={sample.id}
            href={`/e/${sample.id}/`}
            prefetch={false}
            className="group w-[clamp(10.5rem,15vw,15rem)] shrink-0"
          >
            <div className="relative aspect-video overflow-hidden rounded-lg border border-line/60 bg-raised">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxyImage(sample.cover, 480) ?? sample.cover}
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
  )
}
