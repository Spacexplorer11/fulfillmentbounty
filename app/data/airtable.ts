import type { CaseRecord } from './cases.ts'

const BASE_ID = process.env.AIRTABLE_BASE_ID ?? 'appZsKqurpcqFSdjX'
const TABLE_ID = process.env.AIRTABLE_TABLE_ID ?? 'tblA92HVIjjTG9atD'
// "Promise Fulfillment Status". It is the only field requested: the table also holds names, emails,
// phone numbers and addresses, and asking for just this one keeps them out of this process entirely.
const STATUS_FIELD = 'fldelkdJ0nhMei58I'

interface ListResponse {
  records: { createdTime: string; fields: Record<string, unknown> }[]
  offset?: string
}

/** Every case in the table, read with a read-only personal access token. */
export async function fetchCases(token: string): Promise<CaseRecord[]> {
  let cases: CaseRecord[] = []
  let offset: string | undefined

  do {
    let url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`)
    url.searchParams.set('pageSize', '100')
    url.searchParams.set('returnFieldsByFieldId', 'true')
    url.searchParams.append('fields[]', STATUS_FIELD)
    if (offset) url.searchParams.set('offset', offset)

    let response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error(`Airtable responded with ${response.status}`)

    let page = (await response.json()) as ListResponse
    for (let { createdTime, fields } of page.records) {
      let status = fields[STATUS_FIELD]
      cases.push({ createdAt: createdTime, status: typeof status === 'string' ? status : null })
    }
    offset = page.offset
  } while (offset)

  return cases
}
