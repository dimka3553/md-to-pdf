# md-to-pdf

Converts Markdown to PDFs and provides web scraping capabilities.

## Features

- Convert Markdown text to styled PDF documents
- Scrape web pages and convert to Markdown
- Extract HTML content from web pages
- Multiple theme options (light/dark)
- Multiple paper sizes (A4/Letter)

## API Endpoints

### Convert Markdown to PDF
`POST /api/convert`

Convert markdown content to PDF.

**Request Body:**
```json
{
  "markdown": "# Your markdown content here",
  "theme": "light", // or "dark"
  "paperSize": "A4" // or "Letter"
}
```

### Scrape Web Page to Markdown
`GET /api/scrape?url=https://example.com&noCache=true`

Scrape a web page and return the content as Markdown.

**Parameters:**
- `url` (required): The URL to scrape
- `noCache` (optional): Set to "true" to ignore cache

**Response:**
```json
{
  "status": "Ok",
  "page": {
    "url": "https://example.com",
    "content": "# Scraped content as markdown..."
  },
  "metadata": {
    "duration": 1234,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### Scrape Web Page to HTML
`GET /api/scrapehtml?url=https://example.com&noCache=true`

Scrape a web page and return the content as HTML.

**Parameters:**
- `url` (required): The URL to scrape
- `noCache` (optional): Set to "true" to ignore cache

**Response:**
```json
{
  "status": "Ok",
  "page": {
    "url": "https://example.com",
    "content": "<h1>Scraped content as HTML...</h1>"
  },
  "metadata": {
    "duration": 1234,
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## Usage Examples

### Using curl

```bash
# Scrape a page to markdown
curl "http://localhost:3000/api/scrape?url=https://example.com"

# Scrape a page to HTML
curl "http://localhost:3000/api/scrapehtml?url=https://example.com"

# Convert markdown to PDF
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Hello World","theme":"light","paperSize":"A4"}' \
  --output document.pdf
```

### Using JavaScript/fetch

```javascript
// Scrape to markdown
const response = await fetch('/api/scrape?url=' + encodeURIComponent('https://example.com'));
const data = await response.json();
console.log(data.page.content); // Markdown content

// Scrape to HTML
const htmlResponse = await fetch('/api/scrapehtml?url=' + encodeURIComponent('https://example.com'));
const htmlData = await htmlResponse.json();
console.log(htmlData.page.content); // HTML content
```

## Development

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.