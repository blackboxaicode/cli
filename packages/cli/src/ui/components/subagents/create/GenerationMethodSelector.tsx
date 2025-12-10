/**
 * @license
 * Copyright 2025 Blackbox
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box } from 'ink';
import { RadioButtonSelect } from '../../shared/RadioButtonSelect.js';
import type { WizardStepProps } from '../types.js';

interface GenerationOption {
  label: string;
  value: 'blackbox' | 'manual';
}

const generationOptions: GenerationOption[] = [
  {
    label: 'Generate with Blackbox Code (Recommended)',
    value: 'blackbox',
  },
  {
    label: 'Manual Creation',
    value: 'manual',
  },
];

/**
 * Step 2: Generation method selection.
 */
export function GenerationMethodSelector({
  state,
  dispatch,
  onNext,
  onPrevious: _onPrevious,
}: WizardStepProps) {
  const handleSelect = (selectedValue: string) => {
    const method = selectedValue as 'blackbox' | 'manual';
    dispatch({ type: 'SET_GENERATION_METHOD', method });
    onNext();
  };

  return (
    <Box flexDirection="column">
      <RadioButtonSelect
        items={generationOptions.map((option) => ({
          label: option.label,
          value: option.value,
        }))}
        initialIndex={generationOptions.findIndex(
          (opt) => opt.value === state.generationMethod,
        )}
        onSelect={handleSelect}
        isFocused={true}
      />
    </Box>
  );
}
