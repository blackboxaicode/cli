/**
 * @license
 * Copyright 2025 Blackbox
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import {
  RadioButtonSelect,
  type RadioSelectItem,
} from './shared/RadioButtonSelect.js';
import { TextInput } from './shared/TextInput.js';
import { useKeypress } from '../hooks/useKeypress.js';
import type { AvailableModel } from '../models/availableModels.js';

export interface ModelSelectionDialogProps {
  availableModels: AvailableModel[];
  currentModel: string;
  onSelect: (modelId: string) => void;
  onCancel: () => void;
}

export const ModelSelectionDialog: React.FC<ModelSelectionDialogProps> = ({
  availableModels,
  currentModel,
  onSelect,
  onCancel,
}) => {
  const [modelSearch, setModelSearch] = useState('');

  // Reset search when dialog is opened (when availableModels changes from empty to populated)
  useEffect(() => {
    if (availableModels.length > 0) {
      setModelSearch('');
    }
  }, [availableModels.length]);

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onCancel();
      }
    },
    { isActive: true },
  );

  // Filter models based on search
  const filteredModels = availableModels.filter((model) =>
    model.label.toLowerCase().includes(modelSearch.toLowerCase()) ||
    model.id.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  const options: Array<RadioSelectItem<string>> = filteredModels.map(
    (model) => {
      const visionIndicator = model.isVision ? ' [Vision]' : '';
      const currentIndicator = model.id === currentModel ? ' (current)' : '';
      return {
        label: `${model.label}${visionIndicator}${currentIndicator}`,
        value: model.id,
      };
    },
  );

  const initialIndex = Math.max(
    0,
    filteredModels.findIndex((model) => model.id === currentModel),
  );

  const handleSelect = (modelId: string) => {
    onSelect(modelId);
  };

  const handleModelSearchSubmit = () => {
    // Only submit if there are no filtered results (custom model entry)
    // If there are filtered results, the RadioButtonSelect should handle selection
    if (filteredModels.length > 0) {
      return; // Don't submit, let RadioButtonSelect handle it
    }

    if (!modelSearch.trim()) {
      return; // Don't submit empty search
    }

    // Allow custom model entry
    onSelect(modelSearch.trim());
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      padding={1}
      width="100%"
      marginLeft={1}
    >
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Select Model</Text>
        <Text>Search for a model or enter a custom model name:</Text>
      </Box>

      <Box marginBottom={1}>
        <TextInput
          value={modelSearch}
          onChange={setModelSearch}
          onSubmit={handleModelSearchSubmit}
          placeholder="Search models or enter custom model name..."
          isActive={true}
        />
      </Box>

      {filteredModels.length > 0 && (
        <Box marginBottom={1}>
          <RadioButtonSelect
            items={options}
            initialIndex={initialIndex}
            onSelect={handleSelect}
            isFocused={true}
            maxItemsToShow={8}
            showScrollArrows={true}
            showNumbers={false}
          />
        </Box>
      )}

      {modelSearch && filteredModels.length === 0 && (
        <Box marginBottom={1}>
          <Text color={Colors.Gray}>
            No matching models. Press Enter to use {modelSearch} as custom model.
          </Text>
        </Box>
      )}

      <Box>
        <Text color={Colors.Gray}>
          {filteredModels.length > 0
            ? 'Type to filter, use ↑↓ to navigate, Enter to select, Esc to cancel'
            : 'Type model name and press Enter to use custom model, Esc to cancel'}
        </Text>
      </Box>
    </Box>
  );
};
