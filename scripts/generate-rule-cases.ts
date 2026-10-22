// Writes the pgTAP test that checks the database rules against the same cases
// as the zod schemas (src/lib/workout/rule-cases.ts).
//   npm run rules:generate
import { writeFileSync } from "node:fs";

import { ruleCasesSql } from "../src/lib/workout/rule-cases-sql";

const path = "supabase/tests/database/14_rule_cases.test.sql";
writeFileSync(path, ruleCasesSql());
console.log(`Wrote ${path}`);
