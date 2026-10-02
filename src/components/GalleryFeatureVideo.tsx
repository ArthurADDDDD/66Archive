import { MediaFrame } from '@/components/MediaFrame'
import { GalleryFeatureCredits } from '@/components/GalleryFeatureCredits'
import { proxyImage } from '@/lib/platforms'
import { GALLERY_FEATURE_VIDEO as V } from '@/lib/gallery-feature-video'

/** 封面在桌面占左半栏，手机接近整宽。 */
const COVER_WIDTHS = [720, 1280] as const
const COVER_SIZES = '(min-width: 1024px) 50vw, 92vw'

const total = V.stages.reduce((n, s) => n + s.credits.length, 0)

/**
 * 画廊底部的一期纪念视频：左封面、右标题与简介，点进去去 B 站看（本站只索引，不放播放器）。
 * 下面默认折叠着这一期素材的逐条出处（见 GalleryFeatureCredits）。
 */
export function GalleryFeatureVideo() {
  return (
    <section aria-labelledby="gallery-feature-video-title" className="site-container-wide px-page pb-16 sm:pb-20">
      <div className="border-t border-line/70 pt-10">
        <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-10">
          <a
            href={V.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${V.title}（去${V.platform}观看）`}
            data-analytics-event="source.open"
            data-analytics-target="bilibili"
            className="ui-press group block rounded-xl"
          >
            <MediaFrame
              src={proxyImage(V.cover, 1280)}
              alt={`${V.title} 封面`}
              widths={COVER_WIDTHS}
              sizes={COVER_SIZES}
              className="transition-[border-color] group-hover:border-live/50"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-base/80 px-2 py-0.5 font-mono text-meta text-ink tnum backdrop-blur-sm sm:bottom-4 sm:right-4"
              >
                {V.duration}
              </span>
            </MediaFrame>
          </a>
          <div>
            <h2 id="gallery-feature-video-title" className="text-h2 font-semibold text-ink">
              <a href={V.url} target="_blank" rel="noopener noreferrer" className="ui-press rounded-sm hover:text-live">
                {V.title}
              </a>
            </h2>
            <p className="mt-3 text-meta text-faint tnum">
              {V.platform} · {V.uploader} · {V.date} · {V.duration}
            </p>
            <div className="mt-5 space-y-2 text-body text-muted">
              {V.blurb.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <a
              href={V.url}
              target="_blank"
              rel="noopener noreferrer"
              data-analytics-event="source.open"
              data-analytics-target="bilibili"
              className="ui-press mt-6 inline-block rounded-sm text-body font-medium text-live underline decoration-live/40 underline-offset-8 hover:text-ink"
            >
              去观看 →
            </a>
          </div>
        </div>

        <details className="group mt-10 rounded-xl border border-line/70 bg-surface/60">
          <summary className="ui-press flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-control text-muted hover:text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
            <span>
              这一期用到的素材出处
              <span className="ml-2 text-meta text-faint tnum">{total} 条</span>
            </span>
            <span aria-hidden className="font-mono text-faint transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="border-t border-line/60 px-4 pb-5 pt-5 sm:px-5">
            <GalleryFeatureCredits stages={V.stages} />
            <p className="mt-4 text-meta leading-relaxed text-faint">{V.thanks}</p>
          </div>
        </details>
      </div>
    </section>
  )
}
