# Social Innovation Project

A Next.js web application with Supabase backend.

## Prerequisites

- **Node.js v20+** (required by Next.js 15 and Tailwind CSS v4)
  - If you use [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20`
- **npm** (comes with Node.js)

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd Social-Innovation-Project
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

You can find these values in your [Supabase dashboard](https://supabase.com/dashboard) under **Project Settings > API**.

> **Note:** `.env.local` is gitignored and will not be committed. Each developer needs to create their own copy.

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command         | Description                  |
| --------------- | ---------------------------- |
| `npm run dev`   | Start development server     |
| `npm run build` | Create production build      |
| `npm start`     | Start production server      |
| `npm run lint`  | Run ESLint                   |

## Project Structure

```
Social-Innovation-Project/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   └── globals.css         # Global styles (Tailwind CSS)
│   └── utils/
│       └── supabase/
│           ├── client.ts       # Browser-side Supabase client
│           ├── server.ts       # Server-side Supabase client
│           └── middleware.ts   # Middleware helper for session refresh
├── .env.local                  # Environment variables (not committed)
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── postcss.config.mjs          # PostCSS / Tailwind configuration
└── package.json
```

## Supabase Setup

This project uses [Supabase](https://supabase.com/) as its backend. The connection is configured via two utility files:

- **`src/utils/supabase/server.ts`** — Use this in Server Components and Route Handlers. Pass the cookie store from `next/headers`:
  ```ts
  import { createClient } from '@/utils/supabase/server'
  import { cookies } from 'next/headers'

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  ```

- **`src/utils/supabase/client.ts`** — Use this in Client Components (`'use client'`):
  ```ts
  import { createClient } from '@/utils/supabase/client'

  const supabase = createClient()
  ```

- **`src/utils/supabase/middleware.ts`** — Used in Next.js middleware to keep user sessions refreshed.

## Tech Stack

- [Next.js](https://nextjs.org/) 15 (App Router)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Supabase](https://supabase.com/) (database, auth, realtime)
