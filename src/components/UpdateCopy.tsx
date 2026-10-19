'use client'

import { useSiteText } from './LiveContentProvider'
import { updateCopyId, type UpdateCategory, type UpdateCopyEntry, type UpdateField } from '@/lib/update-copy'

/**
 * The update schedule (date, type, release identity) stays curated in code;
 * titles and descriptions share the normal site-copy live editing pipeline.
 */
export function UpdateCopy({ category, entry, field }: {
  category: UpdateCategory
  entry: UpdateCopyEntry
  field: UpdateField
}) {
  const text = useSiteText(updateCopyId(category, entry, field))
  return <>{text}</>
}
