# Not Jeopardy

A party trivia game for a room full of people. One person hosts from their phone, everyone else plays from theirs, and a TV or laptop shows the board.

## How a game works

- **Host** (phone): creates a room, uploads a clue file, sets the timers, picks clues, and judges answers.
- **Players** (phones): join with the room code, create or pick a team (each team has its own name and color), buzz in, and enter the final-round wager and answer.
- **Display** (TV or laptop): shows the board, clues, and scores, and plays the sounds. Tap "Tap to enable sound" once on it.

Each round: a team picks a clue, buzzers open, the first team in answers out loud, and the host marks it right or wrong. A wrong answer locks that team out and reopens buzzers for the others. After the last board comes a final round where every team wagers and writes an answer.

## Clue files

The host uploads a JSON file. See [samples/sample-clues.json](samples/sample-clues.json) for the format and [shared/clueFile.ts](shared/clueFile.ts) for the exact rules. In short:

- `boards`: one per round, each with `columns` (a `topic` plus `questions`, each with `question`, `answer`, `value`).
- `final`: `topic`, `question`, `answer`.
- Any clue can have `questionMedia` / `answerMedia`: `{ "type": "image" | "audio" | "video", "src": "/media/file.jpg" or "https://..." }`. Audio and video clues hold the buzzers until they finish playing.
- A clue with an empty question or answer is skipped.

Sounds go in [public/sounds/](public/sounds/README.txt). Any that are missing fall back to built-in tones.

## Development

Built with React, Vite, and Tailwind on a Cloudflare Worker. Each room is a Durable Object (`worker/index.ts`) that holds the game state, runs the timers, and sends each person only what they're allowed to see.

```sh
npm install
npm run dev      # local dev server (Worker + app)
npm run build    # type-check and build
npm run lint     # oxlint
npm run deploy   # build and deploy with Wrangler
```

Code layout:

- `shared/`: types, message schemas, and the clue file schema used by both sides.
- `worker/`: the server (one `Room` per room code).
- `src/`: the React app. `src/room/` handles the connection, timers, and sounds; `src/screens/` has one folder per role.
