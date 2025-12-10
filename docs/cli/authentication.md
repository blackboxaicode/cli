# Authentication Setup

Blackbox Code supports two main authentication methods to access AI models. Choose the method that best fits your use case:

1.  **Blackbox OAuth (Recommended):**
    - Use this option to log in with your blackbox.ai account.
    - During initial startup, Blackbox Code will direct you to the blackbox.ai authentication page. Once authenticated, your credentials will be cached locally so the web login can be skipped on subsequent runs.
    - **Requirements:**
      - Valid blackbox.ai account
      - Internet connection for initial authentication
    - **Benefits:**
      - Seamless access to Blackbox models
      - Automatic credential refresh
      - No manual API key management required
      - **Automatic Remote Code MCP Server setup** - When you configure BlackboxAI as your provider, the CLI automatically sets up the remote-code MCP server, giving you access to powerful remote execution capabilities with multi-agent support

    **Getting Started:**

    ```bash
    # Start Blackbox Code and follow the OAuth flow
    blackbox
    ```

    The CLI will automatically open your browser and guide you through the authentication process.
    
    **Note:** When you select BlackboxAI as your provider during the initial setup or via the `/auth` command, the remote-code MCP server will be automatically configured for your project. This provides access to remote task execution, GitHub integration, and multi-agent coding capabilities.

    **For users who authenticate using their blackbox.ai account:**

    **Quota:**
    - 60 requests per minute
    - 2,000 requests per day
    - Token usage is not applicable

    **Cost:** Free

    **Notes:** A specific quota for different models is not specified; model fallback may occur to preserve shared experience quality.

2.  **<a id="openai-api"></a>OpenAI-Compatible API:**
    - Use API keys for OpenAI or other compatible providers.
    - This method allows you to use various AI models through API keys.

    **Configuration Methods:**

    a) **Environment Variables:**

    ```bash
    export OPENAI_API_KEY="your_api_key_here"
    export OPENAI_BASE_URL="your_api_endpoint"  # Optional
    export OPENAI_MODEL="your_model_choice"     # Optional
    ```

    b) **Project `.env` File:**
    Create a `.env` file in your project root:

    ```env
    OPENAI_API_KEY=your_api_key_here
    OPENAI_BASE_URL=your_api_endpoint
    OPENAI_MODEL=your_model_choice
    ```

    **Supported Providers:**
    - OpenAI (https://platform.openai.com/api-keys)
    - Alibaba Cloud Bailian
    - ModelScope
    - OpenRouter
    - Azure OpenAI
    - Any OpenAI-compatible API

## Switching Authentication Methods

To switch between authentication methods during a session, use the `/auth` command in the CLI interface:

```bash
# Within the CLI, type:
/auth
```

This will allow you to reconfigure your authentication method without restarting the application.

### Persisting Environment Variables with `.env` Files

You can create a **`.blackboxcli/.env`** file in your project directory or in your home directory. Creating a plain **`.env`** file also works, but `.blackboxcli/.env` is recommended to keep Blackbox Code variables isolated from other tools.

**Important:** Some environment variables (like `DEBUG` and `DEBUG_MODE`) are automatically excluded from project `.env` files to prevent interference with blackbox-cli behavior. Use `.blackboxcli/.env` files for blackbox-cli specific variables.

Blackbox Code automatically loads environment variables from the **first** `.env` file it finds, using the following search order:

1. Starting in the **current directory** and moving upward toward `/`, for each directory it checks:
   1. `.blackboxcli/.env`
   2. `.env`
2. If no file is found, it falls back to your **home directory**:
   - `~/.blackboxcli/.env`
   - `~/.env`

> **Important:** The search stops at the **first** file encountered—variables are **not merged** across multiple files.

#### Examples

**Project-specific overrides** (take precedence when you are inside the project):

```bash
mkdir -p .blackboxcli
cat >> .blackboxcli/.env <<'EOF'
OPENAI_API_KEY="your-api-key"
OPENAI_BASE_URL="https://api-inference.modelscope.cn/v1"
OPENAI_MODEL="Blackbox/Blackbox3-Coder-480B-A35B-Instruct"
EOF
```

**User-wide settings** (available in every directory):

```bash
mkdir -p ~/.blackboxcli
cat >> ~/.blackboxcli/.env <<'EOF'
OPENAI_API_KEY="your-api-key"
OPENAI_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"
OPENAI_MODEL="blackbox3-coder-plus"
EOF
```

## Non-Interactive Mode / Headless Environments

When running Blackbox Code in a non-interactive environment, you cannot use the OAuth login flow.
Instead, you must configure authentication using environment variables.

The CLI will automatically detect if it is running in a non-interactive terminal and will use the
OpenAI-compatible API method if configured:

1.  **OpenAI-Compatible API:**
    - Set the `OPENAI_API_KEY` environment variable.
    - Optionally set `OPENAI_BASE_URL` and `OPENAI_MODEL` for custom endpoints.
    - The CLI will use these credentials to authenticate with the API provider.

**Example for headless environments:**

```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_BASE_URL="https://api-inference.modelscope.cn/v1"
export OPENAI_MODEL="Blackbox/Blackbox3-Coder-480B-A35B-Instruct"

# Run Blackbox Code
blackbox
```

If no API key is set in a non-interactive session, the CLI will exit with an error prompting you to configure authentication.
