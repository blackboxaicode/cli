# Web Search Tool (`web_search`)

This document describes the `web_search` tool.

## Description

Use `web_search` to perform a web search. The tool automatically selects the appropriate search provider based on your configuration:

- **BLACKBOX AI Provider**: Uses BLACKBOX AI's native web search with the `blackbox-search` model suffix
- **Other Providers**: Uses the Tavily API for web search

The tool returns a concise answer with sources when possible.

### Arguments

`web_search` takes one argument:

- `query` (string, required): The search query.

## How to use `web_search`

### With BLACKBOX AI Provider

When using BLACKBOX AI as your provider (e.g.,`https://api.blackboxai.com/v1`), the tool automatically uses BLACKBOX AI's native web search capability:


The tool uses the model `blackboxai/blackbox-search` to perform web searches and returns results with citations.

### With Other Providers (Tavily)

For other providers, `web_search` calls the Tavily API directly. You must configure the `TAVILY_API_KEY` through one of the following methods:

1. **Settings file**: Add `"tavilyApiKey": "your-key-here"` to your `settings.json`
2. **Environment variable**: Set `TAVILY_API_KEY` in your environment or `.env` file
3. **Command line**: Use `--tavily-api-key your-key-here` when running the CLI

If the key is not configured and you're not using BLACKBOX AI, the tool will be disabled.

Usage:

```
web_search(query="Your query goes here.")
```

## `web_search` examples

### Example 1: Finding Latest News

```
web_search(query="latest releases from OpenAI")
```

**Response**: Returns recent announcements about OpenAI's latest models, features, and updates with source citations.

### Example 2: Technical Information

```
web_search(query="React 19 new features and improvements")
```

**Response**: Provides information about React 19's new features with links to official documentation and blog posts.

### Example 3: Current Events

```
web_search(query="AI developments in January 2025")
```

**Response**: Returns recent AI news and developments with timestamps and source URLs.

### Example 4: Best Practices

```
web_search(query="TypeScript error handling best practices 2025")
```

**Response**: Provides current best practices with examples and links to authoritative sources.

### Example 5: Product Comparisons

```
web_search(query="comparison of Next.js 15 vs Remix")
```

**Response**: Returns comparative analysis with pros/cons and source citations.

### Example 6: Documentation Lookup

```
web_search(query="Tailwind CSS v4 breaking changes")
```

**Response**: Provides information about breaking changes with links to official migration guides.

## Important notes

- **Automatic Provider Detection**: The tool automatically detects if you're using BLACKBOX AI and uses the appropriate search method.
- **BLACKBOX AI Search**: When using BLACKBOX AI, searches are performed using the `:online` model suffix, which provides integrated web search with citations.
- **Tavily Search**: For other providers, the tool uses Tavily API for advanced web search capabilities.
- **Response Format**: Both methods return a concise answer with a list of source links.
- **Citations**: Source links are appended as a numbered list with titles and URLs.
- **No Additional Configuration**: When using BLACKBOX AI, no additional API keys are needed for web search.
