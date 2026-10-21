// Regenerates the core-library seed migration and docs/review-core-library.md
// from src/lib/library/. Run with: npm run library:generate

import { writeFileSync } from "node:fs";

import {
  MIGRATION_PATH,
  REVIEW_DOC_PATH,
  buildMigrationSql,
  buildReviewMarkdown,
} from "@/lib/library/generate";

writeFileSync(MIGRATION_PATH, buildMigrationSql());
writeFileSync(REVIEW_DOC_PATH, buildReviewMarkdown());
console.log(`Wrote ${MIGRATION_PATH} and ${REVIEW_DOC_PATH}`);
