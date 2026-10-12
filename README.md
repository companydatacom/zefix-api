# Swiss Zefix register API by CompanyData

[![npm](https://img.shields.io/npm/v/@companydata/zefix-api.svg)](https://www.npmjs.com/package/@companydata/zefix-api)

A small, typed TypeScript wrapper for looking up **Swiss company data from the Zefix central business name index**: company names, full street addresses, phone, email, website, size and revenue, through one REST call.

This package is a thin convenience layer over the master [`@companydata/companydata-sdk`](https://github.com/companydatacom/companydata-sdk). It is the same API and the same key, with the country pinned to Switzerland and a register-specific helper on top, so you can write `client.getByUid("CHE-105.909.036")` instead of assembling query parameters by hand.

> One schema, one key. Every CompanyData register wrapper returns records in the same shape, so moving from Zefix to another country's register is a one-line change.

## At a glance

| | |
| --- | --- |
| Country | 🇨🇭 Switzerland (`countryCode: "CH"`) |
| Register | Swiss Zefix register |
| Businesses in CompanyData | 1.37M |
| With phone number | 536K |
| With email address | 353K |
| Lookup key | UID (`CHE-123.456.789`) |
| Verified example | Nestle S.A., `CHE-105.909.036` |
| Live demo and comparison | [companydata.com/zefix-api](https://companydata.com/zefix-api/) |
| Official register | [zefix.admin.ch](https://www.zefix.admin.ch) |

Counts are from the live API on 2026-10-12 and grow over time.

## What is Zefix?

**Zefix** is the Swiss central business name index, run by the Federal Office of Justice, and the entry point to the cantonal commercial registers. Its public API at [zefix.admin.ch](https://www.zefix.admin.ch) finds a company by name or UID and returns the register entry.

What the official Zefix API does **not** give you: no phone number, no email address, no website, no employee or revenue figures, and no filtering by city, canton, industry or size.

**CompanyData adds the missing fields.** 1.37M Swiss businesses with full addresses, phone, email, website, directors and firmographics, filterable and exportable in bulk through one live REST API. Comparison and a live lookup: [companydata.com/zefix-api](https://companydata.com/zefix-api/).

## Installation

```bash
npm install @companydata/zefix-api
```

Get an API key at [app.companydata.com/signup-api](https://app.companydata.com/signup-api). Your first calls are free.

## Quickstart

```ts
import { ZefixClient } from "@companydata/zefix-api";

const client = new ZefixClient({
  auth: { type: "apiKey", apiKey: process.env.COMPANYDATA_API_KEY! }
});

// Look up one business. UID lookup is not supported on current Swiss data
// (see Known limitations), so search by name and city.
const { records } = await client.search({ search: "Nestle", cityName: "VEVEY", pageSize: 1 });
const company = records[0]; // Nestle S.A.

// Search with filters (country is always CH here).
const page = await client.search({
  cityName: "ZURICH",
  hasEmail: true,
  hasWebsite: true,
  page: 1,
  pageSize: 25
});
console.log(page.totalCount, page.records[0]?.["Company Name"]);
```

> **City and province names are UPPER CASE.** Filter on `cityName: "ZURICH"`, not `"Zurich"` (which returns 0). The same goes for `provinceName: "VAUD"`. List exact names per country with `GET /api/cities`. Full field and filter reference: [companydata.com/api-docs/request-company](https://companydata.com/api-docs/request-company/).

Run the full example against the live API with your key:

```bash
git clone https://github.com/companydatacom/zefix-api && cd zefix-api && npm install
COMPANYDATA_API_KEY=... npm run test:live
```

## What a record looks like

Every record is a flat object with human-readable keys. This is Nestle S.A. as returned by `search`:

```json
{
  "Company Name": "Nestle S.A.",
  "Trade Name": null,
  "Company Registration Number": "CHE-105.909.036",
  "Address 1": "Avenue Nestle 55",
  "Postal Code": "1800",
  "City": "Vevey",
  "State/Province": "Vaud",
  "Country": "Switzerland",
  "Phone Number": "+4*****11",
  "Email": null,
  "Website": "save-food.*****",
  "Founding Year": 1866,
  "Employees Total": 291000,
  "Yearly Revenue in U.S. Dollars": 111185776620,
  "Business Category Code 1 - Description": "Offices of Holding Companies, Not Elsewhere Classified",
  "Business Legal Type - Description": "Corporation"
}
```

**Search is a preview, export is the full record.** `search` (and the lookup helper, which uses it) returns about 20 fields with phone, email and website masked as `*****`, and does not spend credits. `export`, `exportWithScroll` and `iterate` return the full record (about 35 fields, unmasked contact details, SIC and national industry codes, legal status, group structure) and spend one credit per company you have not exported before. Which fields are on a record depends on your key's configuration. See the [field reference](https://companydata.com/api-docs/request-company/) and [plans and credits](https://companydata.com/api-docs/authentication/).

## Methods

| Method | Returns | Does |
| --- | --- | --- |
| `client.search(params)` | `ZefixPage` | Search Swiss businesses with filters. |
| `client.getByUid(id, scope?)` | `CompanyRecord \| null` | Fetch one business by UID. `scope` adds extra filters when a number is not unique. |
| `client.export(params)` | `ZefixPage` | Export one page of results (standard pagination). |
| `client.exportWithScroll(params)` | `ZefixScrollBatch` | One scroll batch (max 50 records). Pass `scrollId` back in for the next. |
| `client.iterate(params, { maxRecords })` | `AsyncGenerator<CompanyRecord>` | Streams every matching record across scroll batches. |
| `client.raw` | `ApiClient` | The underlying master SDK client, for anything not wrapped here. |
| `normalizeZefixId(id)` | `string` | The UID normalisation the lookup helper applies. |

```ts
interface ZefixPage {
  records: CompanyRecord[];   // flat objects, keys like "Company Name", "City", "Email"
  totalCount: number;         // matches across all pages
  page: number;
  totalPages: number;
  pageSize: number;
}

interface ZefixScrollBatch {
  records: CompanyRecord[];
  scrollId: string | null;    // pass back in to get the next batch
  hasMoreRecords: boolean;
  pageSize: number;
}
```

`params` is the master SDK's filter set with `countryCode` removed, because it is always `"CH"` here. For cross-border queries, use the master SDK directly.

### Lookup by UID

`getByUid` takes the Swiss UID (`CHE-105.909.036`). Whitespace is stripped and letters are upper-cased. **On current data this lookup returns `null` for Swiss records**, see Known limitations. Use `search` with the company name instead.

## Recipes

**Find a company by name, pinned to a city**

```ts
const { records, totalCount } = await client.search({
  search: "Nestle",
  cityName: "VEVEY",
  pageSize: 5
});
```

**Build a segment: companies in a province with 50 or more employees**

```ts
const page = await client.search({
  provinceName: "VAUD",
  employeesTotal: { min: 50 },
  hasPhone: true,
  pageSize: 100
});
```

**Stream a whole segment with scroll export**

```ts
for await (const company of client.iterate(
  { cityName: "ZURICH", hasEmail: true },
  { maxRecords: 5000 }
)) {
  console.log(company["Company Name"], company["Email"]);
}
```

**Drive the scroll loop yourself**

```ts
let batch = await client.exportWithScroll({ cityName: "ZURICH", hasEmail: true, pageSize: 50 });
while (batch.records.length > 0) {
  process(batch.records);
  if (!batch.hasMoreRecords || !batch.scrollId) break;
  batch = await client.exportWithScroll({ cityName: "ZURICH", hasEmail: true, scrollId: batch.scrollId, pageSize: 50 });
}
```

**Anything else: drop to the master client**

```ts
const res = await client.raw.company.search({ countryCode: "DE", cityName: "BERLIN", pageSize: 10 });
```

### Common filters

| Filter | Example | Notes |
| --- | --- | --- |
| `search` | `"Nestle"` | Free text over company and trade names. |
| `nationalId` | `"CHE-105.909.036"` | Registration number. The lookup helper sets this for you. |
| `cityName` | `"ZURICH"` | UPPER CASE. |
| `provinceName` | `"VAUD"` | Admin-2 name, UPPER CASE (the record's `State/Province`). |
| `postalCode` | `"1800"` | Exact match. |
| `hasEmail`, `hasPhone`, `hasWebsite` | `true` | Contact availability. |
| `employeesTotal`, `annualSales`, `foundingYears` | `{ min: 50, max: 500 }` | Range filters. |
| `sic4Digits` | `"7372"` | 4-digit SIC industry code. |

Full list: [companydata.com/api-docs/request-company](https://companydata.com/api-docs/request-company/).

## Known limitations

- Swiss records carry the UID in `Company Registration Number`, but the API's `nationalId` filter does not match on it yet, so `getByUid` currently returns `null`. Use `search` with the company name (and `cityName`) until that is fixed.
- City names are stored without umlauts in the filter index: `ZURICH`, not `ZÜRICH`.

## Four ways to integrate

Pick whichever fits how you build. All four hit the same data behind the same key.

1. **This register SDK** (`@companydata/zefix-api`): Swiss lookups with a Zefix-specific helper. You are here.
2. **Master SDK** ([`@companydata/companydata-sdk`](https://github.com/companydatacom/companydata-sdk)): all 200+ countries in one typed client, keyed by `countryCode`.
3. **MCP server**: connect an AI agent (Claude, Cursor and others) to `https://companydata.com/mcp/` with your key in the `x-api-key` header. See [companydata-mcp-server](https://github.com/companydatacom/companydata-mcp-server).
4. **Raw REST**: call `GET https://app.companydata.com/api/company/search?countryCode=CH&cityName=ZURICH` with an `x-api-key` header. Contract: [companydata.com/openapi.json](https://companydata.com/openapi.json).

```bash
curl -H "x-api-key: $COMPANYDATA_API_KEY" \
  "https://app.companydata.com/api/company/search?countryCode=CH&nationalId=CHE-105.909.036&pageSize=1"
```

## Error handling

Failed requests throw `ApiError` with the HTTP status. The client retries transient failures (429 and 5xx) with backoff before giving up.

```ts
import { ApiError } from "@companydata/zefix-api";

try {
  await client.search({ cityName: "ZURICH" });
} catch (err) {
  if (err instanceof ApiError) {
    // 401: bad or missing key, 429: rate limited,
    // "Export credit limit exceeded" (code credits_limit_exceeded): export credits used up
    console.error(err.status, err.message);
  }
}
```

A scroll batch that is larger than your remaining credits is rejected as a whole, so keep `pageSize` small when a key is close to its limit.

## All register wrappers

Same pattern, one per official register. Every wrapper returns the same record shape.

| Country | Register | Package | Lookup helper |
| --- | --- | --- | --- |
| 🇳🇱 Netherlands | KVK | [`@companydata/kvk-api`](https://github.com/companydatacom/kvk-api) | `getByKvkNumber` |
| 🇩🇪 Germany | Handelsregister | [`@companydata/handelsregister-api`](https://github.com/companydatacom/handelsregister-api) | `getByRegistrationNumber` |
| 🇬🇧 United Kingdom | Companies House | [`@companydata/companies-house-api`](https://github.com/companydatacom/companies-house-api) | `getByCompanyNumber` |
| 🇫🇷 France | Sirene | [`@companydata/sirene-api`](https://github.com/companydatacom/sirene-api) | `getBySiret` |
| 🇧🇪 Belgium | KBO/BCE | [`@companydata/kbo-api`](https://github.com/companydatacom/kbo-api) | `getByEnterpriseNumber` |
| 🇵🇱 Poland | KRS | [`@companydata/krs-api`](https://github.com/companydatacom/krs-api) | `getByNip` |
| 🇸🇪 Sweden | Bolagsverket | [`@companydata/bolagsverket-api`](https://github.com/companydatacom/bolagsverket-api) | `getByOrgNumber` |
| 🇨🇭 Switzerland | Zefix | [`@companydata/zefix-api`](https://github.com/companydatacom/zefix-api) | `getByUid` |
| 🇨🇿 Czech Republic | ARES | [`@companydata/ares-api`](https://github.com/companydatacom/ares-api) | `getByIco` |
| 🇩🇰 Denmark | CVR | [`@companydata/cvr-api`](https://github.com/companydatacom/cvr-api) | `getByCvr` |
| 🇧🇷 Brazil | CNPJ | [`@companydata/cnpj-api`](https://github.com/companydatacom/cnpj-api) | `getByCnpj` |
| 🇦🇺 Australia | ABR | [`@companydata/abn-lookup-api`](https://github.com/companydatacom/abn-lookup-api) | `getByAbn` |
| 🇺🇸 United States | SEC EDGAR | [`@companydata/sec-edgar-api`](https://github.com/companydatacom/sec-edgar-api) | `getByRegistrationNumber` |

Plus the master SDK for every other country: [`@companydata/companydata-sdk`](https://github.com/companydatacom/companydata-sdk).

## License

MIT. Built and maintained by [CompanyData.com](https://companydata.com).
