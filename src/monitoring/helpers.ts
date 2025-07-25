import boxen from 'boxen';
import chalk, { type ChalkInstance } from 'chalk';

import { YELLOW_HEX } from '@/monitoring/types';

type RuleConfig = {
  title: string;
  width?: number;
  bold?: boolean;
  italic?: boolean;
  borderChar?: string;
  borderColor?: string; // Can be hex or named
  textColor?: string; // Can be hex or named
};

export function rule(config: RuleConfig): string {
  const {
    title = '',
    width = globalThis?.process?.stdout?.columns,
    bold = false,
    italic = false,
    borderChar = '━',
    borderColor = YELLOW_HEX,
    textColor = 'white',
  } = config;

  let styledTitle: string = bold ? chalk.bold(title) : title;
  styledTitle = italic ? chalk.italic(styledTitle) : styledTitle;
  const lineLength = Math.max(0, width - title.length - 2);
  const half = Math.floor(lineLength / 2);
  const line = borderChar.repeat(half);

  const getColor = (color: string): ChalkInstance =>
    color.startsWith('#')
      ? chalk.hex(color)
      : (chalk[color as keyof typeof chalk] as ChalkInstance) || ((x: string): string => x);

  const colorizeLine = getColor(borderColor);
  const colorizeText = getColor(textColor);

  const final = `${colorizeLine(line)} ${colorizeText(styledTitle)} ${colorizeLine(line)}`;
  return final;
}

type PanelInput = {
  content: string;
  title: string;
  subtitle?: string;
};

type PanelConfig = {
  contentStyle?: string;
  titleStyle?: string;
  subtitleStyle?: string;
  borderColor?: string;
};

export function panel(
  { content, title, subtitle }: PanelInput,
  { contentStyle, titleStyle, subtitleStyle, borderColor = YELLOW_HEX }: PanelConfig
): string {
  if (titleStyle === 'bold' && title) {
    title = chalk.bold(title);
  }
  if (subtitleStyle === 'bold' && subtitle) {
    subtitle = chalk.bold(subtitle);
  }
  if (contentStyle === 'bold' && content) {
    content = chalk.bold(content);
  }

  return boxen(content, {
    title: `${title} ${subtitle ? `- ${subtitle}` : ''}`,
    titleAlignment: 'center',
    borderColor,
    borderStyle: 'round',
    width: globalThis?.process?.stdout?.columns,
  });
}

export function group(elements: string[]): string {
  return elements.join('\n');
}

// export function table(data: any[]): string {
//   return new Table({ head: });
// }
