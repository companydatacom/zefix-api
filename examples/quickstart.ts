/**
 * Live quickstart and smoke test for @companydata/zefix-api.
 *
 * Run:  COMPANYDATA_API_KEY=... npx tsx examples/quickstart.ts
 * Key:  https://app.companydata.com/signup-api (first calls are free)
 *
 * Every call below was verified against the live API. City and province
 * names are matched in UPPER CASE.
 */
import { strict as assert } from "node:assert";
import { ZefixClient, ApiError } from "../src/index";

const apiKey = process.env.COMPANYDATA_API_KEY;
if (!apiKey) {
  console.error("Set COMPANYDATA_API_KEY first. Get one at https://app.companydata.com/signup-api");
  process.exit(1);
}

const client = new ZefixClient({ auth: { type: "apiKey", apiKey } });

try {
  // 1. Look up one business. UID lookup is not supported on current Swiss data
//    (see README > Known limitations), so search by name and city instead.
const found = await client.search({ search: "Nestle", cityName: "VEVEY", pageSize: 1 });
const company = found.records[0] ?? null;
console.log("By name:", company?.["Company Name"], "|", company?.["City"], "|", company?.["Company Registration Number"]);
assert(company, "expected a match for Nestle in VEVEY");

  // 2. Search by name, pinned to a city.
  const byName = await client.search({ search: "Nestle", cityName: "VEVEY", pageSize: 5 });
  console.log(`Search "Nestle" in VEVEY: ${byName.totalCount} matches, first: ${byName.records[0]?.["Company Name"]}`);
  assert(byName.totalCount > 0, "expected search hits");

  // 3. Segment: businesses in a city that have both an email address and a website.
  const segment = await client.search({ cityName: "ZURICH", hasEmail: true, hasWebsite: true, pageSize: 25 });
  console.log(`ZURICH with email + website: ${segment.totalCount} (page ${segment.page} of ${segment.totalPages})`);
  assert(segment.records.length > 0, "expected segment records");

  // 4. Filter on province (admin-2 name, UPPER CASE) and company size.
  const sized = await client.search({ provinceName: "VAUD", employeesTotal: { min: 50 }, pageSize: 1 });
  console.log(`Vaud, 50+ employees: ${sized.totalCount}`);

  // 5. Stream a set with scroll export (3 batches of 10, capped at 25 records).
  //    Export spends one credit per new company, so this is kept small.
  try {
    let pulled = 0;
    let firstEmail: unknown;
    for await (const record of client.iterate({ cityName: "ZURICH", hasEmail: true }, { pageSize: 10, maxRecords: 25 })) {
      firstEmail ??= record["Email"];
      pulled += 1;
    }
    console.log("Streamed records:", pulled, "| first email:", firstEmail ?? "(field not enabled on this key)");
    assert.equal(pulled, 25, "expected 25 streamed records");
  } catch (err) {
    if (err instanceof ApiError && /credit|over limit/i.test(err.message)) {
      console.warn("Export skipped: this key has no export credits left (" + err.message + ")");
    } else {
      throw err;
    }
  }

  console.log("OK");
} catch (err) {
  if (err instanceof ApiError) {
    console.error(`API error ${err.status}: ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
}
