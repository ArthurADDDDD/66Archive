import type { Filters } from '../components/FilterRail'

/** URL state is shared by initial links, client navigation and browser history. */
export function readArchiveQuery(search: string, years: number[], monthsForYear: (year: number) => number[]) {
  const params = new URLSearchParams(search)
  const requestedYear = Number(params.get('y'))
  const year = years.includes(requestedYear) ? requestedYear : years[0] ?? new Date().getFullYear()
  const requestedMonth = params.has('m') ? Number(params.get('m')) : null
  const month = requestedMonth !== null && monthsForYear(year).includes(requestedMonth) ? requestedMonth : null
  const filters: Filters = {
    q: params.get('q') ?? '',
    platforms: params.get('p')?.split(',').filter(Boolean) ?? [],
    types: params.get('t')?.split(',').filter(Boolean) ?? [],
    games: params.get('g')?.split(',').filter(Boolean) ?? [],
    onlyAlive: params.get('alive') === '1',
  }
  return { year, month, filters }
}

export function writeArchiveQuery(filters: Filters, year: number, month: number | null, latestYear: number): string {
  const params = new URLSearchParams()
  if (year !== latestYear) params.set('y', String(year))
  if (month !== null) params.set('m', String(month))
  if (filters.q) params.set('q', filters.q)
  if (filters.platforms.length) params.set('p', filters.platforms.join(','))
  if (filters.types.length) params.set('t', filters.types.join(','))
  if (filters.games.length) params.set('g', filters.games.join(','))
  if (filters.onlyAlive) params.set('alive', '1')
  return params.toString()
}
