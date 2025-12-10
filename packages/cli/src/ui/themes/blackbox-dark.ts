/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { darkSemanticColors } from './semantic-tokens.js';

const blackboxDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#0b0e14',
  Foreground: '#bfbdb6',
  LightBlue: '#59C2FF',
  AccentBlue: '#39BAE6',
  AccentPurple: '#D2A6FF',
  AccentCyan: '#95E6CB',
  AccentGreen: '#AAD94C',
  AccentYellow: '#FFD700',
  AccentRed: '#F26D78',
  DiffAdded: '#AAD94C',
  DiffRemoved: '#F26D78',
  Comment: '#646A71',
  Gray: '#3D4149',
  GradientColors: ['#FFD700', '#da7959'],
};

export const BlackboxDark: Theme = new Theme(
  'Blackbox Dark',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: blackboxDarkColors.Background,
      color: blackboxDarkColors.Foreground,
    },
    'hljs-keyword': {
      color: blackboxDarkColors.AccentYellow,
    },
    'hljs-literal': {
      color: blackboxDarkColors.AccentPurple,
    },
    'hljs-symbol': {
      color: blackboxDarkColors.AccentCyan,
    },
    'hljs-name': {
      color: blackboxDarkColors.LightBlue,
    },
    'hljs-link': {
      color: blackboxDarkColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: blackboxDarkColors.AccentYellow,
    },
    'hljs-subst': {
      color: blackboxDarkColors.Foreground,
    },
    'hljs-string': {
      color: blackboxDarkColors.AccentGreen,
    },
    'hljs-title': {
      color: blackboxDarkColors.AccentYellow,
    },
    'hljs-type': {
      color: blackboxDarkColors.AccentBlue,
    },
    'hljs-attribute': {
      color: blackboxDarkColors.AccentYellow,
    },
    'hljs-bullet': {
      color: blackboxDarkColors.AccentYellow,
    },
    'hljs-addition': {
      color: blackboxDarkColors.AccentGreen,
    },
    'hljs-variable': {
      color: blackboxDarkColors.Foreground,
    },
    'hljs-template-tag': {
      color: blackboxDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: blackboxDarkColors.AccentYellow,
    },
    'hljs-comment': {
      color: blackboxDarkColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: blackboxDarkColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-deletion': {
      color: blackboxDarkColors.AccentRed,
    },
    'hljs-meta': {
      color: blackboxDarkColors.AccentYellow,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  blackboxDarkColors,
  darkSemanticColors,
);
