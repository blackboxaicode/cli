/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';

const blackboxLightColors: ColorsTheme = {
  type: 'light',
  Background: '#f8f9fa',
  Foreground: '#5c6166',
  LightBlue: '#55b4d4',
  AccentBlue: '#399ee6',
  AccentPurple: '#a37acc',
  AccentCyan: '#4cbf99',
  AccentGreen: '#86b300',
  AccentYellow: '#f2ae49',
  AccentRed: '#f07171',
  DiffAdded: '#86b300',
  DiffRemoved: '#f07171',
  Comment: '#ABADB1',
  Gray: '#CCCFD3',
  GradientColors: ['#399ee6', '#86b300'],
};

export const BlackboxLight: Theme = new Theme(
  'Blackbox Light',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: blackboxLightColors.Background,
      color: blackboxLightColors.Foreground,
    },
    'hljs-comment': {
      color: blackboxLightColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: blackboxLightColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-string': {
      color: blackboxLightColors.AccentGreen,
    },
    'hljs-constant': {
      color: blackboxLightColors.AccentCyan,
    },
    'hljs-number': {
      color: blackboxLightColors.AccentPurple,
    },
    'hljs-keyword': {
      color: blackboxLightColors.AccentYellow,
    },
    'hljs-selector-tag': {
      color: blackboxLightColors.AccentYellow,
    },
    'hljs-attribute': {
      color: blackboxLightColors.AccentYellow,
    },
    'hljs-variable': {
      color: blackboxLightColors.Foreground,
    },
    'hljs-variable.language': {
      color: blackboxLightColors.LightBlue,
      fontStyle: 'italic',
    },
    'hljs-title': {
      color: blackboxLightColors.AccentBlue,
    },
    'hljs-section': {
      color: blackboxLightColors.AccentGreen,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: blackboxLightColors.LightBlue,
    },
    'hljs-class .hljs-title': {
      color: blackboxLightColors.AccentBlue,
    },
    'hljs-tag': {
      color: blackboxLightColors.LightBlue,
    },
    'hljs-name': {
      color: blackboxLightColors.AccentBlue,
    },
    'hljs-builtin-name': {
      color: blackboxLightColors.AccentYellow,
    },
    'hljs-meta': {
      color: blackboxLightColors.AccentYellow,
    },
    'hljs-symbol': {
      color: blackboxLightColors.AccentRed,
    },
    'hljs-bullet': {
      color: blackboxLightColors.AccentYellow,
    },
    'hljs-regexp': {
      color: blackboxLightColors.AccentCyan,
    },
    'hljs-link': {
      color: blackboxLightColors.LightBlue,
    },
    'hljs-deletion': {
      color: blackboxLightColors.AccentRed,
    },
    'hljs-addition': {
      color: blackboxLightColors.AccentGreen,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: blackboxLightColors.AccentCyan,
    },
    'hljs-built_in': {
      color: blackboxLightColors.AccentRed,
    },
    'hljs-doctag': {
      color: blackboxLightColors.AccentRed,
    },
    'hljs-template-variable': {
      color: blackboxLightColors.AccentCyan,
    },
    'hljs-selector-id': {
      color: blackboxLightColors.AccentRed,
    },
  },
  blackboxLightColors,
  lightSemanticColors,
);
