/** Run: COMPANYDATA_API_KEY=... npx tsx examples/quickstart.ts */
import { ZefixClient } from "../src/index";

const client = new ZefixClient({ auth: { type: "apiKey", apiKey: process.env.COMPANYDATA_API_KEY! } });

const company = await client.getByUid("CHE-105.962.823");
console.log("By UID:", company);

const page = await client.search({ cityName: "Zurich", hasEmail: true, pageSize: 25 });
console.log("Search:", page.data);
