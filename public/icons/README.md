# Provider Icons

Each enabled provider requires a PNG icon at `/public/icons/{iconKey}.png`.

- Size: 64x64 px (128x128 also fine)
- Format: PNG
- Naming: must match `provider.iconKey` in `config/app.config.default.json`

Defaults shipped with the project (Phase 2):

- `qwen.png` — Qwen
- `chatgpt.png` — ChatGPT
- `claude.png` — Claude

Until the real assets are added, the frontend falls back to a placeholder
badge showing the provider name's first letter (see `src/utils/icons.ts`).