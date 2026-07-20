#!/usr/bin/env node

// Netlify interprets exit code 0 as "ignore this Git-triggered build". AMOS-OPS
// Production is released only by the protected GitHub matching-pair workflow,
// which uploads a verified prebuilt dist/public artifact with Netlify CLI.
process.exitCode = 0;
