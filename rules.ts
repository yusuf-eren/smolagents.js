import boxen from 'boxen';
import chalk from 'chalk';

type RuleConfig = {
  title: string;
  width?: number;
  bold?: boolean;
  borderChar?: string;
  borderColor?: string; // Can be hex or named
  textColor?: string; // Can be hex or named
};

export function rule(config: RuleConfig): string {
  const {
    title = '',
    width = globalThis?.process?.stdout?.columns,
    bold = false,
    borderChar = '━',
    borderColor = 'gray',
    textColor = 'white',
  } = config;

  const styledTitle = bold ? chalk.bold(title) : title;
  const lineLength = Math.max(0, width - title.length - 2);
  const half = Math.floor(lineLength / 2);
  const line = borderChar.repeat(half);

  const getColor = (color: string) =>
    color.startsWith('#')
      ? chalk.hex(color)
      : chalk[color as keyof typeof chalk] || ((x: string) => x);

  const colorizeLine = getColor(borderColor);
  const colorizeText = getColor(textColor);

  const final = `${colorizeLine(line)} ${colorizeText(styledTitle)} ${colorizeLine(line)}`;
  return final;
}

console.log(
  rule({
    title: 'dalga',
    bold: true,
    // borderChar: '=',
    borderColor: '#d4b702',
    // textColor: '#ffeb3b',
  })
);

console.log(
  rule({
    title: ' WARNING ',
    width: 50,
    bold: false,
    borderChar: '─',
    borderColor: 'yellow',
    textColor: 'black',
  })
);

console.log(
  rule({
    title: ' ✔ SUCCESS ',
    width: 70,
    bold: true,
    borderChar: '~',
    borderColor: 'green',
    textColor: '#ffffff',
  })
);

function panel(
  {
    content,
    title,
    subtitle,
  }: {
    content: string;
    title: string;
    subtitle: string;
  },
  {
    contentStyle,
    titleStyle,
    subtitleStyle,
    borderColor = '#d4b702',
  }: {
    contentStyle?: string;
    titleStyle?: string;
    subtitleStyle?: string;
    borderColor?: string;
  }
) {
  /*
    
    Panel(
                f"\n[bold]{escape_code_brackets(content)}\n",
                title="[bold]New run" + (f" - {title}" if title else ""),
                subtitle=subtitle,
                border_style=YELLOW_HEX,
                subtitle_align="left",
            ),
    */

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
    title: `${title} - ${subtitle}`,
    titleAlignment: 'center',
    borderColor,
    borderStyle: 'round',
    width: globalThis?.process?.stdout?.columns,
  });
}

console.log('---olum sikerim ya');

console.log(
  panel(
    {
      title: 'HEYyy',
      subtitle: 'whatsub',
      content: 'content',
    },
    {
      borderColor: '#d4b702',
      contentStyle: 'bold',
      titleStyle: 'bold',
      subtitleStyle: 'bold',
    }
  )
);

import { JsonTheme, fromJson, highlight } from 'cli-highlight';

const code = `
# Hello
This is **markdown**
- item 1
- item 2
`;

const theme: JsonTheme = {
  variable: 'bgBlack',
  string: 'bgBlack',
  number: 'bgBlack',
  attribute: 'bgBlack',
  keyword: 'bgBlack',
  attr: 'bgBlack',
  function: 'bgBlack',
  comment: 'bgBlack',
  bullet: 'bgBlack',
  // ALL BG BLACK
  strong: 'red',
  section: 'red',

  code: 'bgBlack',
  class: 'bgBlack',
  addition: 'bgBlack',

  built_in: 'bgBlack',
};
console.log(
  highlight(code, { language: 'markdown', theme: fromJson(theme), languageSubset: ['markdown'] })
);

const boxedCode = boxen(
  highlight(code, { language: 'markdown', theme: fromJson(theme), languageSubset: ['markdown'] }),
  {
    borderStyle: 'none',
    width: globalThis?.process?.stdout?.columns,
    backgroundColor: '#0c1116',
  }
);

console.log(boxedCode);
