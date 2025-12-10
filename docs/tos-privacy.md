# Blackbox Code: Terms of Service and Privacy Notice

Blackbox Code is an open-source AI coding assistant tool maintained by the Blackbox Code team. This document outlines the terms of service and privacy policies that apply when using Blackbox Code's authentication methods and AI model services.

## How to determine your authentication method

Blackbox Code supports two main authentication methods to access AI models. Your authentication method determines which terms of service and privacy policies apply to your usage:

1. **Blackbox OAuth** - Log in with your blackbox.ai account
2. **OpenAI-Compatible API** - Use API keys from various AI model providers

For each authentication method, different Terms of Service and Privacy Notices may apply depending on the underlying service provider.

| Authentication Method | Provider          | Terms of Service                                                              | Privacy Notice                                       |
| :-------------------- | :---------------- | :---------------------------------------------------------------------------- | :--------------------------------------------------- |
| Blackbox OAuth            | Blackbox AI           | [Blackbox Terms of Service](https://blackbox.ai/termsservice)                         | [Blackbox Privacy Policy](https://blackbox.ai/privacypolicy) |
| OpenAI-Compatible API | Various Providers | Depends on your chosen API provider (OpenAI, Alibaba Cloud, ModelScope, etc.) | Depends on your chosen API provider                  |

## 1. If you are using Blackbox OAuth Authentication

When you authenticate using your blackbox.ai account, these Terms of Service and Privacy Notice documents apply:

- **Terms of Service:** Your use is governed by the [Blackbox Terms of Service](https://blackbox.ai/termsservice).
- **Privacy Notice:** The collection and use of your data is described in the [Blackbox Privacy Policy](https://blackbox.ai/privacypolicy).

For details about authentication setup, quotas, and supported features, see [Authentication Setup](./cli/authentication.md).

## 2. If you are using OpenAI-Compatible API Authentication

When you authenticate using API keys from OpenAI-compatible providers, the applicable Terms of Service and Privacy Notice depend on your chosen provider.

**Important:** When using OpenAI-compatible API authentication, you are subject to the terms and privacy policies of your chosen API provider, not Blackbox Code's terms. Please review your provider's documentation for specific details about data usage, retention, and privacy practices.

Blackbox Code supports various OpenAI-compatible providers. Please refer to your specific provider's terms of service and privacy policy for detailed information.

## Usage Statistics and Telemetry

Blackbox Code may collect anonymous usage statistics and telemetry data to improve the user experience and product quality. This data collection is optional and can be controlled through configuration settings.

### What Data is Collected

When enabled, Blackbox Code may collect:

- Anonymous usage statistics (commands run, performance metrics)
- Error reports and crash data
- Feature usage patterns

### Data Collection by Authentication Method

- **Blackbox OAuth:** Usage statistics are governed by Blackbox's privacy policy. You can opt-out through Blackbox Code's configuration settings.
- **OpenAI-Compatible API:** No additional data is collected by Blackbox Code beyond what your chosen API provider collects.

### Opt-Out Instructions

You can disable usage statistics collection by following the instructions in the [Usage Statistics Configuration](./cli/configuration.md#usage-statistics) documentation.

## Frequently Asked Questions (FAQ)

### 1. Is my code, including prompts and answers, used to train AI models?

Whether your code, including prompts and answers, is used to train AI models depends on your authentication method and the specific AI service provider you use:

- **Blackbox OAuth**: Data usage is governed by [Blackbox's Privacy Policy](https://blackbox.ai/privacy). Please refer to their policy for specific details about data collection and model training practices.

- **OpenAI-Compatible API**: Data usage depends entirely on your chosen API provider. Each provider has their own data usage policies. Please review the privacy policy and terms of service of your specific provider.

**Important**: Blackbox Code itself does not use your prompts, code, or responses for model training. Any data usage for training purposes would be governed by the policies of the AI service provider you authenticate with.

### 2. What are Usage Statistics and what does the opt-out control?

The **Usage Statistics** setting controls optional data collection by Blackbox Code for improving the user experience and product quality.

When enabled, Blackbox Code may collect:

- Anonymous telemetry (commands run, performance metrics, feature usage)
- Error reports and crash data
- General usage patterns

**What is NOT collected by Blackbox Code:**

- Your code content
- Prompts sent to AI models
- Responses from AI models
- Personal information

The Usage Statistics setting only controls data collection by Blackbox Code itself. It does not affect what data your chosen AI service provider (Blackbox, OpenAI, etc.) may collect according to their own privacy policies.

You can disable Usage Statistics collection by following the instructions in the [Usage Statistics Configuration](./cli/configuration.md#usage-statistics) documentation.

### 3. How do I switch between authentication methods?

You can switch between Blackbox OAuth and OpenAI-compatible API authentication at any time:

1. **During startup**: Choose your preferred authentication method when prompted
2. **Within the CLI**: Use the `/auth` command to reconfigure your authentication method
3. **Environment variables**: Set up `.env` files for automatic OpenAI-compatible API authentication

For detailed instructions, see the [Authentication Setup](./cli/authentication.md) documentation.
