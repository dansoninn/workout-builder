// Regenerates the core-library seed migration and docs/core-library.md from
// src/lib/library/. Run with: npm run library:generate

import { writeFileSync } from "node:fs";

import {
  LIBRARY_DOC_PATH,
  MIGRATION_PATH,
  buildLibraryMarkdown,
  buildMigrationSql,
} from "@/lib/library/generate";

writeFileSync(MIGRATION_PATH, buildMigrationSql());
writeFileSync(LIBRARY_DOC_PATH, buildLibraryMarkdown());
console.log(`Wrote ${MIGRATION_PATH} and ${LIBRARY_DOC_PATH}`);
