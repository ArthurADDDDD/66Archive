import { galleryAllPhotosBody } from '@/lib/gallery-all-data'

export const dynamic = 'force-static'

/** 画廊全量版的照片数据，见 `lib/gallery-all-data.ts`。 */
export function GET() {
  return new Response(galleryAllPhotosBody(), { headers: { 'content-type': 'application/json; charset=utf-8' } })
}
