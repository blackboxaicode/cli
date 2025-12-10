# Web Fetch Tool (`web_fetch`)

This document describes the `web_fetch` tool for Blackbox Code.

## Description

Use `web_fetch` to fetch content from a specified URL and process it using an AI model. The tool takes a URL and a prompt as input, fetches the URL content with cache-busting enabled to ensure the latest data, converts HTML to markdown, and processes the content with the prompt using a small, fast model. The tool automatically includes the current date and time context to help the AI provide temporally relevant responses.

### Arguments

`web_fetch` takes two arguments:

- `url` (string, required): The URL to fetch content from. Must be a fully-formed valid URL starting with `http://` or `https://`.
- `prompt` (string, required): The prompt describing what information you want to extract from the page content.

## How to use `web_fetch` with Blackbox Code

To use `web_fetch` with Blackbox Code, provide a URL and a prompt describing what you want to extract from that URL. The tool will ask for confirmation before fetching the URL. Once confirmed, the tool will fetch the content directly with cache-busting mechanisms enabled and process it using an AI model.

### Cache-Busting for Latest Results

The tool implements multiple cache-busting mechanisms to ensure you always get the latest content:

- **Cache-Control Headers**: Sends `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache`, and `Expires: 0` headers to prevent caching
- **Timestamp Parameter**: Adds a unique timestamp query parameter (`_t`) to the URL to bypass cached responses
- **Temporal Context**: Includes the current date and time in the AI prompt to help prioritize the most recent information

The tool automatically converts HTML to text, handles GitHub blob URLs (converting them to raw URLs), and upgrades HTTP URLs to HTTPS for security.

Usage:

```
web_fetch(url="https://example.com", prompt="Summarize the main points of this article")
```

## `web_fetch` examples

Summarize a single article:

```
web_fetch(url="https://example.com/news/latest", prompt="Can you summarize the main points of this article?")
```

Extract specific information:

```
web_fetch(url="https://arxiv.org/abs/2401.0001", prompt="What are the key findings and methodology described in this paper?")
```

Analyze GitHub documentation:

```
web_fetch(url="https://github.com/llmcod/Blackbox/blob/main/README.md", prompt="What are the installation steps and main features?")
```

## Important notes

- **Single URL processing:** `web_fetch` processes one URL at a time. To analyze multiple URLs, make separate calls to the tool.
- **URL format:** The tool automatically upgrades HTTP URLs to HTTPS and converts GitHub blob URLs to raw format for better content access.
- **Content processing:** The tool fetches content directly with cache-busting enabled and processes it using an AI model, converting HTML to readable text format.
- **Fresh content guarantee:** The tool uses multiple cache-busting techniques (headers and timestamp parameters) to ensure you always receive the latest content from the URL, not cached versions.
- **Temporal awareness:** The AI model receives the current date and time context, making it better at identifying and prioritizing the most recent information when you ask for "latest" data.
- **Output quality:** The quality of the output will depend on the clarity of the instructions in the prompt.
- **MCP tools:** If an MCP-provided web fetch tool is available (starting with "mcp\_\_"), prefer using that tool as it may have fewer restrictions.
