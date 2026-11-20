// Runs on staged files only, so the pre-commit hook stays fast.
// ESLint goes through `next lint` (the same entry point as `npm run lint`) because
// the repo uses a legacy .eslintrc.json config. `next lint` takes one --file per call.
const lintCommands = (files) => files.map((file) => `next lint --fix --file "${file}"`);

export default {
  "*.{ts,tsx,js,jsx,mjs}": lintCommands,
  "*.{ts,tsx,js,jsx,mjs,json,md,css}": ["prettier --write"],
};
