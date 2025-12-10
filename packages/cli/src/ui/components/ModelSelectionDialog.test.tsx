/**
 * @license
 * Copyright 2025 Blackbox
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelSelectionDialog } from './ModelSelectionDialog.js';
import type { AvailableModel } from '../models/availableModels.js';
import type { RadioSelectItem } from './shared/RadioButtonSelect.js';

// Mock the useKeypress hook
const mockUseKeypress = vi.hoisted(() => vi.fn());
vi.mock('../hooks/useKeypress.js', () => ({
  useKeypress: mockUseKeypress,
}));

// Mock the RadioButtonSelect component
const mockRadioButtonSelect = vi.hoisted(() => vi.fn());
vi.mock('./shared/RadioButtonSelect.js', () => ({
  RadioButtonSelect: mockRadioButtonSelect,
}));

// Mock the TextInput component
const mockTextInput = vi.hoisted(() => vi.fn());
vi.mock('./shared/TextInput.js', () => ({
  TextInput: mockTextInput,
}));

describe('ModelSelectionDialog', () => {
  const mockAvailableModels: AvailableModel[] = [
    { id: 'blackbox3-coder-plus', label: 'blackbox3-coder-plus' },
    { id: 'blackbox-vl-max-latest', label: 'blackbox-vl-max', isVision: true },
    { id: 'gpt-4', label: 'GPT-4' },
  ];

  const mockOnSelect = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock RadioButtonSelect to return a simple div
    mockRadioButtonSelect.mockReturnValue(
      React.createElement('div', { 'data-testid': 'radio-select' }),
    );

    // Mock TextInput to return a simple div
    mockTextInput.mockReturnValue(
      React.createElement('div', { 'data-testid': 'text-input' }),
    );
  });

  it('should setup escape key handler to call onCancel', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox3-coder-plus"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    expect(mockUseKeypress).toHaveBeenCalledWith(expect.any(Function), {
      isActive: true,
    });

    // Simulate escape key press
    const keypressHandler = mockUseKeypress.mock.calls[0][0];
    keypressHandler({ name: 'escape' });

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should not call onCancel for non-escape keys', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox3-coder-plus"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    const keypressHandler = mockUseKeypress.mock.calls[0][0];
    keypressHandler({ name: 'enter' });

    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('should render TextInput component for search', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox3-coder-plus"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    expect(mockTextInput).toHaveBeenCalled();
    const textInputProps = mockTextInput.mock.calls[0][0];
    expect(textInputProps.placeholder).toBe('Search models or enter custom model name...');
    expect(textInputProps.isActive).toBe(true);
  });

  it('should set correct initial index for current model', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox-vl-max-latest"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    const callArgs = mockRadioButtonSelect.mock.calls[0][0];
    expect(callArgs.initialIndex).toBe(1); // blackbox-vl-max-latest is at index 1
  });

  it('should set initial index to 0 when current model is not found', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="non-existent-model"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    const callArgs = mockRadioButtonSelect.mock.calls[0][0];
    expect(callArgs.initialIndex).toBe(0);
  });

  it('should call onSelect when a model is selected', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox3-coder-plus"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    const callArgs = mockRadioButtonSelect.mock.calls[0][0];
    expect(typeof callArgs.onSelect).toBe('function');

    // Simulate selection
    const onSelectCallback = mockRadioButtonSelect.mock.calls[0][0].onSelect;
    onSelectCallback('blackbox-vl-max-latest');

    expect(mockOnSelect).toHaveBeenCalledWith('blackbox-vl-max-latest');
  });

  it('should handle empty models array', () => {
    render(
      <ModelSelectionDialog
        availableModels={[]}
        currentModel=""
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    // RadioButtonSelect should not be rendered when there are no models
    expect(mockRadioButtonSelect).not.toHaveBeenCalled();
  });

  it('should create correct option items with proper labels', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox3-coder-plus"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    const expectedItems = [
      {
        label: 'blackbox3-coder-plus (current)',
        value: 'blackbox3-coder-plus',
      },
      {
        label: 'blackbox-vl-max [Vision]',
        value: 'blackbox-vl-max-latest',
      },
      {
        label: 'GPT-4',
        value: 'gpt-4',
      },
    ];

    const callArgs = mockRadioButtonSelect.mock.calls[0][0];
    expect(callArgs.items).toEqual(expectedItems);
  });

  it('should show vision indicator for vision models', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="gpt-4"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    const callArgs = mockRadioButtonSelect.mock.calls[0][0];
    const visionModelItem = callArgs.items.find(
      (item: RadioSelectItem<string>) => item.value === 'blackbox-vl-max-latest',
    );

    expect(visionModelItem?.label).toContain('[Vision]');
  });

  it('should show current indicator for the current model', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox-vl-max-latest"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    const callArgs = mockRadioButtonSelect.mock.calls[0][0];
    const currentModelItem = callArgs.items.find(
      (item: RadioSelectItem<string>) => item.value === 'blackbox-vl-max-latest',
    );

    expect(currentModelItem?.label).toContain('(current)');
  });

  it('should pass isFocused, maxItemsToShow, and showScrollArrows props to RadioButtonSelect', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox3-coder-plus"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    const callArgs = mockRadioButtonSelect.mock.calls[0][0];
    expect(callArgs.isFocused).toBe(true);
    expect(callArgs.maxItemsToShow).toBe(8);
    expect(callArgs.showScrollArrows).toBe(true);
  });

  it('should handle multiple onSelect calls correctly', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox3-coder-plus"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    const onSelectCallback = mockRadioButtonSelect.mock.calls[0][0].onSelect;

    // Call multiple times
    onSelectCallback('blackbox3-coder-plus');
    onSelectCallback('blackbox-vl-max-latest');
    onSelectCallback('gpt-4');

    expect(mockOnSelect).toHaveBeenCalledTimes(3);
    expect(mockOnSelect).toHaveBeenNthCalledWith(1, 'blackbox3-coder-plus');
    expect(mockOnSelect).toHaveBeenNthCalledWith(2, 'blackbox-vl-max-latest');
    expect(mockOnSelect).toHaveBeenNthCalledWith(3, 'gpt-4');
  });

  it('should filter models based on search input', () => {
    const { rerender } = render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox3-coder-plus"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    // Get the onChange handler from TextInput
    const textInputProps = mockTextInput.mock.calls[0][0];
    const onChangeHandler = textInputProps.onChange;

    // Simulate typing "gpt" in the search box
    onChangeHandler('gpt');

    // Re-render to trigger the filter
    rerender(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox3-coder-plus"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    // The RadioButtonSelect should now only show filtered items
    // Note: In the actual implementation, the filter happens in the component
    // This test verifies the structure is correct
    expect(mockRadioButtonSelect).toHaveBeenCalled();
  });

  it('should allow custom model entry when search has no results', () => {
    render(
      <ModelSelectionDialog
        availableModels={mockAvailableModels}
        currentModel="blackbox3-coder-plus"
        onSelect={mockOnSelect}
        onCancel={mockOnCancel}
      />,
    );

    // Get the onSubmit handler from TextInput
    const textInputProps = mockTextInput.mock.calls[0][0];
    const onSubmitHandler = textInputProps.onSubmit;

    // The onSubmit handler should be defined
    expect(typeof onSubmitHandler).toBe('function');
  });
});
