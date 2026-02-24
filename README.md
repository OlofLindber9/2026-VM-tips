# Ski Predictor

A cross-country ski prediction game for the FIS World Cup season. Create a group with your friends, predict the podium for each race, and see who knows the sport best.

---

## How It Works

1. **Sign up** and create or join a group using an 8-character invite code
2. **Before each race**, pick your top 3 finishers (1st, 2nd, 3rd)
3. **After the race**, results are synced from FIS and predictions are automatically scored
4. **Check the leaderboard** to see who's winning the season

### Scoring

| Prediction | Points |
|---|---|
| Predicted 1st = Actual 1st | 3 pts |
| Predicted 2nd finished in top 3 | +1 pt |
| Predicted 3rd finished in top 3 | +1 pt |
| **Maximum per race** | **5 pts** |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| UI | React 19, Tailwind CSS |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 5 |
| Auth | Supabase Auth (email/password) |
| Data source | FIS official website (HTML scraping via Cheerio) |
| Hosting | Vercel |

---
## Feedback

Got a bug or suggestion? Send an email to [ololin0725@gmail.com](mailto:ololin0725@gmail.com?subject=Ski%20Predictor%20Feedback).

---

*Powered by FIS official data · Not affiliated with FIS*
