# Contributing to COMMONS

Thanks for your interest. This project was built for a hackathon, but the code is
open and contributions are welcome.

## Getting set up

1. Make sure you have **Node.js 20 or newer** installed.
2. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file and fill in your own keys:
   ```bash
   cp .env.example .env
   ```
4. Start the app in development:
   ```bash
   npm run dev:server   # the API server
   npm run dev          # the web app (in a second terminal)
   ```

## Ground rules

- **Keep secrets out of the code.** Anything sensitive lives in `.env`, which is
  never committed. Anything the browser can see is prefixed `VITE_` and is public
  by design.
- **Validate every input.** All data coming into the API is checked before use.
- **Treat AI output as untrusted.** Render it safely; never run it as code.
- **Write clear commit messages.** One short line describing the change.

## Before you open a pull request

- Run the type checker: `npm run typecheck`
- Run the linter: `npm run lint` (Biome)
- Run the tests: `npm test`
- Run the security audit: `npm run audit:security`

Please describe what your change does and why. Small, focused pull requests are
easiest to review.
