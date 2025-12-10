/**
 * @license
 * Copyright 2025 BlackboxAI
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';

const DEFAULT_BLACKBOX_BASE_URL = 'https://api.blackbox.ai';
const DEFAULT_BLACKBOX_MODEL = 'blackboxai/x-ai/grok-code-fast-1:free';

interface BlackboxKeyPromptProps {
  onSubmit: (apiKey: string, baseUrl: string, model: string) => void;
  onCancel: () => void;
}

export function BlackboxKeyPrompt({
  onSubmit,
  onCancel,
}: BlackboxKeyPromptProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl] = useState(DEFAULT_BLACKBOX_BASE_URL);
  const [model, setModel] = useState('');
  const [currentField, setCurrentField] = useState<
    'apiKey' | 'model'
  >('apiKey');

  useInput((input, key) => {
    // Filter paste-related control sequences
    let cleanInput = (input || '')
      // Filter ESC-prefixed control sequences (e.g., \u001b[200~, \u001b[201~, etc.)
      .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '') // eslint-disable-line no-control-regex
      // Filter paste start marker [200~
      .replace(/\[200~/g, '')
      // Filter paste end marker [201~
      .replace(/\[201~/g, '')
      // Filter standalone [ and ~ characters (possible paste marker remnants)
      .replace(/^\[|~$/g, '');

    // Filter all invisible characters (ASCII < 32, except carriage return and newline)
    cleanInput = cleanInput
      .split('')
      .filter((ch) => ch.charCodeAt(0) >= 32)
      .join('');

    if (cleanInput.length > 0) {
      if (currentField === 'apiKey') {
        setApiKey((prev) => prev + cleanInput);
      } else if (currentField === 'model') {
        setModel((prev) => prev + cleanInput);
      }
      return;
    }

    // Check if it's the Enter key (by checking if input contains newline)
    if (input.includes('\n') || input.includes('\r')) {
      if (currentField === 'apiKey') {
        // Allow empty API key to jump to next field, user can return to modify later
        setCurrentField('model');
        return;
      } else if (currentField === 'model') {
        // Only check if API key is empty when submitting
        if (apiKey.trim()) {
          // Use default model if model field is empty
          const finalModel = model.trim() || DEFAULT_BLACKBOX_MODEL;
          onSubmit(apiKey.trim(), baseUrl.trim(), finalModel);
        } else {
          // If API key is empty, return to API key field
          setCurrentField('apiKey');
        }
      }
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    // Handle Tab key for field navigation
    if (key.tab) {
      if (currentField === 'apiKey') {
        setCurrentField('model');
      } else if (currentField === 'model') {
        setCurrentField('apiKey');
      }
      return;
    }

    // Handle arrow keys for field navigation
    if (key.upArrow) {
      if (currentField === 'model') {
        setCurrentField('apiKey');
      }
      return;
    }

    if (key.downArrow) {
      if (currentField === 'apiKey') {
        setCurrentField('model');
      }
      return;
    }

    // Handle backspace - check both key.backspace and delete key
    if (key.backspace || key.delete) {
      if (currentField === 'apiKey') {
        setApiKey((prev) => prev.slice(0, -1));
      } else if (currentField === 'model') {
        setModel((prev) => prev.slice(0, -1));
      }
      return;
    }
  });

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold color={Colors.AccentBlue}>
        BlackboxAI Configuration Required
      </Text>
      <Box marginTop={1}>
        <Text>
          Please enter your BlackboxAI configuration. You can get an API key from{' '}
          <Text color={Colors.AccentBlue}>
            https://www.blackbox.ai/
          </Text>
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text
            color={currentField === 'apiKey' ? Colors.AccentBlue : Colors.Gray}
          >
            API Key:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'apiKey' ? '> ' : '  '}
            {apiKey || ' '}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box width={12}>
          <Text
            color={currentField === 'model' ? Colors.AccentBlue : Colors.Gray}
          >
            Model:
          </Text>
        </Box>
        <Box flexGrow={1}>
          <Text>
            {currentField === 'model' ? '> ' : '  '}
            {model?.length ? (
              model
            ) : (
              <Text color={Colors.Gray} dimColor>
                {/* This is the default model defined in config file */}
                {DEFAULT_BLACKBOX_MODEL}
              </Text>
            )}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.Gray}>
          Press Enter to continue, Tab/↑↓ to navigate, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
