# DSA Recall Coach

A local-first workspace for saving DSA problems, practicing recall before revealing solutions, scheduling reviews, exploring topics, and reviewing activity based on your actual saved data.

## Requirements

- Node.js 22 or newer
- npm

## Install and run

```sh
npm install
npm run dev
```

Vite prints the local development URL when the server is ready. Open it in a browser to use the app.

## Build and checks

```sh
npm run build
npm run lint
npm run test:backup
npm run test:practice
npm run test:analytics
npm run test:topics
npm run test:calendar
npm run test:scheduler
```

`npm run build` runs the TypeScript project build before producing the optimized site in `dist/`. `npm run preview` serves that production build locally.

## Modules

- **My problems:** create and edit problems, filter the library, and manage editable starter examples.
- **Recall:** attempt the saved prompts before revealing a solution, then save an outcome, confidence, and reflection.
- **Practice:** filter the saved library, prioritize due reviews, save a recall draft, reveal hints or solutions intentionally, and persist a graded session.
- **Revision calendar:** view scheduled reviews by month or week.
- **Patterns & topics:** organize saved problems by their topic and solving pattern.
- **Analytics:** summarize saved problems, recall outcomes, review activity, confidence, and category coverage. These are counts and trends from saved records, not mastery scores.
- **Settings & data:** change the theme and export or import a backup. Open it from the profile menu in the top bar.

## Data storage and privacy

Problem records, recall history, practice drafts, scheduler dates, and the selected theme are stored in this browser using `localStorage`. This is **local browser storage, not cloud synchronization**: the app does not sync data to an account or another device. Data may be lost if browser site data or local storage is cleared, so export backups regularly and keep copies somewhere safe.

The first-run problem library provides three editable starter examples (Two Sum, Contains Duplicate, and Best Time to Buy and Sell Stock). Practice reads from that same saved library; it does not maintain a second problem dataset.

## Backup and restore

Open **Your profile → Settings & data**:

- Select **Export JSON backup** to download a versioned `dsa-recall-coach-backup-*.json` file. It contains saved problems and recall attempts, including outcomes, confidence, reflections, and scheduling dates, intervals, and streaks.
- Select **Choose backup to import** and choose a JSON file. The app validates its format, version, problem records, recall records, and scheduler fields before offering an import confirmation.
- Confirming an import replaces the current saved problem library and recall history. Cancel keeps the existing data. Invalid files are rejected without changing stored records.

Theme preference is stored separately and is not included in the data backup. Exporting a backup is the recommended way to preserve data before clearing browser storage or moving to another device.
