<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9ca9e089-b02c-42dd-8464-db94ab6419e0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` to your OpenAI API key. (Optional) override `OPENAI_MODEL` if you want a different Responses API model (defaults to `gpt-4.1-nano` for lowest cost).
3. Run the app:
   `npm run dev`
