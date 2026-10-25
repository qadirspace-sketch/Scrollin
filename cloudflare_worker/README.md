# LinkedIn Post Tagger Worker

This worker provides AI embeddings comparison for tagging LinkedIn posts.

## Setup

1. Install Wrangler:
   ```bash
   npm install -g wrangler
   ```

2. Login to Cloudflare:
   ```bash
   wrangler login
   ```

3. Deploy:
   ```bash
   wrangler deploy
   ```

## Usage

Send a POST request to the deployed URL with:
```json
{
  "text": "Your post content here..."
}
```
