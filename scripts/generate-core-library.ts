// Regenerates the core-library migrations, docs/core-library.md and
// docs/pace-defaults.md from src/lib/library/. Run with: npm run library:generate

import { writeFileSync } from "node:fs";

import {
  IMPLEMENT_COUNT_MIGRATION_PATH,
  LIBRARY_DOC_PATH,
  MIGRATION_PATH,
  buildImplementCountMigrationSql,
  buildLibraryMarkdown,
  buildMigrationSql,
} from "@/lib/library/generate";
import { PACE_DOC_PATH, buildPaceMarkdown } from "@/lib/library/pace-doc";

const outputs: [string, string][] = [
  [MIGRATION_PATH, buildMigrationSql()],
  [IMPLEMENT_COUNT_MIGRATION_PATH, buildImplementCountMigrationSql()],
  [LIBRARY_DOC_PATH, buildLibraryMarkdown()],
  [PACE_DOC_PATH, buildPaceMarkdown()],
];
for (const [path, content] of outputs) {
  writeFileSync(path, content);
  console.log(`Wrote ${path}`);
}
