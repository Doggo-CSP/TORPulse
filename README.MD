# 📡 TORPulse

> **Thailand Government Procurement (TOR) Monitoring & Ingestion Platform**

TORPulse is a full-stack platform designed to automate the discovery, ingestion, parsing, AI analysis, and monitoring of Thai Government Terms of Reference (TOR) procurement documents across platforms like **GovSpending**, **Central e-GP**, and **BMA e-GP**.

---

## 🚀 Features

- 🔍 **Automated Procurement Discovery**: Queue producers & ingestion workers continuously poll and index e-GP & GovSpending procurement APIs.
- 📄 **PDF Extraction & Parsing**: Intelligent parsing of TOR PDF documents to extract budgets, submission deadlines, contact details, project scope, and technological requirements.
- 🧠 **AI Classification & Analysis**: DeepSeek AI model integrations for classifying procurement scope, evaluating project objectives, and scoring confidence.
- 📊 **Analytics Dashboard**: Dynamic charts, budget insights, and keyword tracking powered by Recharts & TanStack React Query.
- 🔐 **Authentication & User Profiles**: Secure Google OAuth 2.0 single sign-on (SSO) and user profile preferences.
- 🛠️ **Repair & Maintenance Tooling**: Built-in CLI scripts for repairing missing TOR data and testing ingestion pipelines.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router) & [React 19](https://react.dev/)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & Headless UI
- **State & Data Fetching**: [TanStack Query v5 (React Query)](https://tanstack.com/query/v5)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Icons**: Heroicons

### Backend & Distributed Workers
- **Runtime**: Node.js with [Express 5](https://expressjs.com/)
- **Language**: TypeScript (executed with `tsx`)
- **Database**: [MongoDB](https://www.mongodb.com/) via [Mongoose 9](https://mongoosejs.com/)
- **Authentication**: Passport.js with Google OAuth 2.0 & MongoDB Session storage
- **PDF Extraction**: `@opendataloader/pdf` & `fflate`
- **Validation**: Zod

---

## 📁 Repository Structure

```
TORPulse/
├── app/
│   ├── backend/               # Node.js / Express backend & worker services
│   │   ├── src/
│   │   │   ├── apps/          # Entrypoints for micro-apps
│   │   │   │   ├── api/                   # REST API server (`server.ts`)
│   │   │   │   ├── ingestion-worker/      # TOR PDF & data processor (`main.ts`)
│   │   │   │   ├── queue-producer/        # Procurement data scraper (`main.ts`)
│   │   │   │   └── notification-worker/   # Alert worker (`main.ts`)
│   │   │   ├── config/        # Environment & MongoDB configuration
│   │   │   ├── middleware/    # Auth, error handling, session middleware
│   │   │   ├── modules/       # Domain modules (auth, tor, ingestion, user)
│   │   │   └── scripts/       # CLI repair & test scripts
│   │   └── package.json
│   │
│   └── frontend/              # Next.js frontend application
│       ├── src/
│       │   ├── api/           # API client layer
│       │   ├── app/           # Next.js App Router pages (homepage, auth, profile)
│       │   ├── components/    # Reusable UI components
│       │   ├── hooks/         # Custom React hooks
│       │   └── providers/     # React Query & Auth providers
│       └── package.json
│
├── CONTRIBUTING.md            # Guidelines for branching & commit standards
└── README.MD                  # Project documentation
```

---

## ⚙️ Environment Configuration

### Backend Setup (`app/backend/.env`)

Create an `.env` file inside `app/backend/`:

Copy the example file to .env

```bash
cd app/backend
cp .env.example .env
```

On Windows PowerShell:

```bash
cd app/backend
Copy-Item .env.example .env
```

Then update the values in .env with your local configuration.

```env
# Server Config
PORT=8000
NODE_ENV=development

# Database Config
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=torpulse

# Auth & Session Config
SESSION_SECRET=your-32-character-minimum-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:8000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000

# GovSpending API Config (Optional)
GOVSPENDING_API_KEY=your-govspending-api-key
GOVSPENDING_SYNC_INTERVAL_MS=600000
GOVSPENDING_FISCAL_YEAR=2568
GOVSPENDING_KEYWORDS=ซอฟต์แวร์,ระบบสารสนเทศ,พัฒนาระบบ,โปรแกรมคอมพิวเตอร์,แอปพลิเคชัน,เว็บไซต์,software,application,website

# DeepSeek AI Integration (Optional)
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-v4-flash
```

### Frontend Setup (`app/frontend/.env.local`)

Create an `.env.local` file inside `app/frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🏁 Getting Started

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **MongoDB**: Active instance running locally or via cloud (MongoDB Atlas)

### 1. Install Dependencies

```bash
# Install backend dependencies
cd app/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Run Development Servers

#### **Start Backend REST API**
```bash
cd app/backend
npm run dev
# API running at http://localhost:8000
```

#### **Start Frontend App**
```bash
cd app/frontend
npm run dev
# Web App running at http://localhost:3000
```

#### **Start Background Workers (Optional)**
```bash
cd app/backend

# Ingestion Worker (Processes queue jobs & extracts TOR PDFs)
npm run dev:ingestion

# Queue Producer (Polls GovSpending & e-GP sources)
npm run dev:producer
```

---

## 🧪 Testing & Utility Scripts

In `app/backend/`:

```bash
# Run unit & integration test suites
npm run test:tor            # TOR model, repository & repair tests
npm run test:auth           # Authentication & route tests
npm run test:producer       # GovSpending discovery & producer tests
npm run test:central-egp     # Central e-GP adapter tests

# Utility & Repair Scripts
npm run repair:missing-tors  # Utility to repair missing TOR documents

# Type Check & Linting
npm run type-check          # Run TypeScript type check
npm run format:check        # Check code formatting with Prettier
```

In `app/frontend/`:

```bash
npm run lint                # ESLint code linting
npm run build               # Production build test
```

---

## 🤝 Contributing

Contributions are welcome! Please refer to [`CONTRIBUTING.md`](file:///c:/Users/User/.antigravity-ide/TORPulse/CONTRIBUTING.md) for branch naming conventions, Conventional Commit standards, and pull request guidelines.

---

## 📜 License

ISC License. See the codebase for more details.
