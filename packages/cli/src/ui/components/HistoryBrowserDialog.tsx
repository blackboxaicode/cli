/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import type { Logger } from '@blackbox_ai/blackbox-cli-core';

interface CheckpointItem {
  tag: string;
  timestamp: Date;
  messageCount: number;
  firstMessagePreview: string;
  isAutoSave: boolean;
}

interface HistoryBrowserDialogProps {
  logger: Logger;
  onResume: (tag: string) => void;
  onDelete: (tag: string) => void;
  onClose: () => void;
}

export const HistoryBrowserDialog: React.FC<HistoryBrowserDialogProps> = ({
  logger,
  onResume,
  onDelete,
  onClose,
}) => {
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(
    null,
  );

  // Load checkpoints on mount
  useEffect(() => {
    const loadCheckpoints = async () => {
      try {
        await logger.initialize();
        const items = await logger.listAllCheckpoints();
        // Sort by timestamp (newest first)
        items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setCheckpoints(items);
      } catch (_error) {
        console.error('Failed to load checkpoints:', _error);
      } finally {
        setLoading(false);
      }
    };

    loadCheckpoints();
  }, [logger]);

  const handleDelete = useCallback(
    async (index: number) => {
      const checkpoint = checkpoints[index];
      if (!checkpoint) return;

      try {
        await logger.deleteCheckpoint(checkpoint.tag);
        // Remove from list
        const newCheckpoints = checkpoints.filter((_, i) => i !== index);
        setCheckpoints(newCheckpoints);
        // Adjust selected index if needed
        if (selectedIndex >= newCheckpoints.length) {
          setSelectedIndex(Math.max(0, newCheckpoints.length - 1));
        }
        setDeleteConfirmIndex(null);
        onDelete(checkpoint.tag);
      } catch (_error) {
        console.error('Failed to delete checkpoint:', _error);
      }
    },
    [checkpoints, selectedIndex, logger, onDelete],
  );

  useKeypress(
    (key) => {
      // If in delete confirmation mode
      if (deleteConfirmIndex !== null) {
        if (key.name === 'return') {
          handleDelete(deleteConfirmIndex);
        } else if (key.name === 'escape' || key.name === 'n') {
          setDeleteConfirmIndex(null);
        } else if (key.name === 'y') {
          handleDelete(deleteConfirmIndex);
        }
        return;
      }

      // Normal navigation mode
      if (key.name === 'up' || key.name === 'k') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.name === 'down' || key.name === 'j') {
        setSelectedIndex((prev) => Math.min(checkpoints.length - 1, prev + 1));
      } else if (key.name === 'return') {
        const checkpoint = checkpoints[selectedIndex];
        if (checkpoint) {
          onResume(checkpoint.tag);
        }
      } else if (
        key.name === 'delete' ||
        key.name === 'backspace' ||
        key.name === 'd'
      ) {
        if (checkpoints.length > 0) {
          setDeleteConfirmIndex(selectedIndex);
        }
      } else if (key.name === 'escape' || key.name === 'q') {
        onClose();
      }
    },
    { isActive: true },
  );

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const formatTagName = (tag: string): string => {
    // Check if tag looks like a timestamp (e.g., "2025-11-24T18-34-38-727Z" or "autosave-1234567890")
    const timestampMatch = tag.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
    if (timestampMatch) {
      try {
        // Convert the timestamp format to ISO format
        const isoString = timestampMatch[1].replace(/-(\d{2})-(\d{2})-(\d{3})Z$/, ':$1:$2.$3Z');
        const date = new Date(isoString);
        if (!isNaN(date.getTime())) {
          // Format as "Nov 24, 2025 at 6:34 PM"
          return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
      } catch (_e) {
        // Fall through to return original tag
      }
    }
    
    // Check for autosave-timestamp format
    const autosaveMatch = tag.match(/^autosave-(\d+)$/);
    if (autosaveMatch) {
      try {
        const timestamp = parseInt(autosaveMatch[1], 10);
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return `Auto-save from ${date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })}`;
        }
      } catch (_e) {
        // Fall through to return original tag
      }
    }
    
    return tag;
  };

  if (loading) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={Colors.AccentBlue}
        padding={1}
        width="100%"
      >
        <Text>Loading conversation history...</Text>
      </Box>
    );
  }

  if (deleteConfirmIndex !== null) {
    const checkpoint = checkpoints[deleteConfirmIndex];
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={Colors.AccentRed}
        padding={1}
        width="100%"
      >
        <Text color={Colors.AccentRed} bold>
          Delete Confirmation
        </Text>
        <Box marginTop={1} marginBottom={1}>
          <Text>
            Are you sure you want to delete checkpoint &quot;
            <Text color={Colors.AccentPurple}>{checkpoint?.tag}</Text>
            &quot;?
          </Text>
        </Box>
        <Text dimColor>
          Press Y to confirm, N or Escape to cancel
        </Text>
      </Box>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={Colors.AccentBlue}
        padding={1}
        width="100%"
      >
        <Text color={Colors.AccentBlue} bold>
          Conversation History
        </Text>
        <Box marginTop={1} marginBottom={1}>
          <Text dimColor>No saved conversations found.</Text>
        </Box>
        <Text dimColor>Press Escape to close</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={Colors.AccentBlue}
      padding={1}
      width="100%"
    >
      <Text color={Colors.AccentBlue} bold>
        Conversation History ({checkpoints.length})
      </Text>

      <Box marginTop={1} marginBottom={1} flexDirection="column">
        {checkpoints.map((checkpoint, index) => {
          const isSelected = index === selectedIndex;
          const prefix = isSelected ? '▶ ' : '  ';

          return (
            <Box key={checkpoint.tag} flexDirection="column" marginBottom={1}>
              <Box>
                <Text
                  color={isSelected ? Colors.AccentPurple : undefined}
                  bold={isSelected}
                >
                  {prefix}
                  {checkpoint.firstMessagePreview || checkpoint.tag}
                </Text>
              </Box>
              <Box paddingLeft={3}>
                <Text dimColor>
                  {formatTimestamp(checkpoint.timestamp)} • {checkpoint.messageCount} messages
                </Text>
              </Box>
              <Box paddingLeft={3}>
                <Text dimColor wrap="truncate">
                  {formatTagName(checkpoint.tag)}
                  {checkpoint.isAutoSave && (
                    <Text dimColor> [auto-save]</Text>
                  )}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box borderStyle="single" borderColor={Colors.Gray} paddingX={1}>
        <Text dimColor>
          ↑/↓: Navigate • Enter: Resume • D/Delete: Delete • Esc/Q: Close
        </Text>
      </Box>
    </Box>
  );
};
