import winston from 'winston';

// function rule(title = '', width = 50): string {
//   // Create a rule line similar to rich.Panel, with padding and a title
//   const paddingY = 1;
//   const paddingX = 2;
//   const content = 'Hello';
//   const borderChar = '-';
//   const borderColor = '\x1b[32m'; // green
//   const resetColor = '\x1b[0m';

//   // Calculate the available width for the rule line
//   const ruleWidth = width;
//   const titleStr = title ? ` ${title} ` : '';
//   const sideLen = Math.floor((ruleWidth - titleStr.length) / 2);
//   const left = borderChar.repeat(sideLen);
//   const right = borderChar.repeat(ruleWidth - sideLen - titleStr.length);

//   return borderColor + left + titleStr + right + resetColor;
// }

// console.log(rule('Greeting', 50));

// Simulate a "rich.Panel" style box using boxen
import boxen from 'boxen';

// Get console width and height
// const width = process.stdout.columns;
// const height = process.stdout.rows;
// console.log(width, height);

// console.log(
//   boxen('Hello', {
//     title: 'Greeting',
//     titleAlignment: 'center',
//     borderStyle: 'round', // Default in rich.Panel
//     borderColor: '#d4b702', // Equals to border_style in rich.Panel
//     float: 'center', // Default in rich.Panel
//     width: process?.stdout?.columns, // Default in rich.Panel
//     padding: { left: 1, right: 1 }, // Default in rich.Panel
//   })
// );

import * as ras from 'cli-highlight';

const code = `
from rich import print                                                                                                                 
from rich.panel import Panel                                                                                                           
                                                                                                                                       
print(Panel("Hello", title="Greeting", border_style="#d4b702")
`;

const codeJS = `
const randomNumber = Math.random();
console.log(randomNumber);

function randomNumber() {
  return Math.random();
}

console.log(randomNumber());
`;

const r: ras.JsonTheme = {
  keyword: 'yellow',
  built_in: 'cyan',
  string: 'green',
  number: 'magenta',
  literal: 'magenta',
  regexp: 'red',
  class: 'cyan',
  function: 'blue',
  title: 'blue',
  params: 'white',
  comment: 'gray',
  doctag: 'gray',
  meta: 'gray',
  'meta-keyword': 'magenta',
  'meta-string': 'green',
  subst: 'white',
  symbol: 'magenta',
  bullet: 'magenta',
  section: 'yellow',
  tag: 'cyan',
  name: 'blue',
  attr: 'cyan',
  variable: 'bgRed',
  type: 'cyan',
  addition: 'green',
  deletion: 'red',
  attribute: 'cyan',
  'selector-tag': 'yellow',
  'selector-id': 'blue',
  'selector-class': 'green',
  'selector-attr': 'cyan',
  'selector-pseudo': 'magenta',
};

const highlightedCode = ras.highlight(codeJS, {
  language: 'javascript',
  theme: ras.fromJson(r),
});

const boxedHighlight = boxen(highlightedCode, {
  title: 'Greeting',
  titleAlignment: 'center',
  borderStyle: 'round', // Default in rich.Panel
  //   borderColor: '#d4b702', // Equals to border_style in rich.Panel
  float: 'center', // Default in rich.Panel
  width: process?.stdout?.columns, // Default in rich.Panel
  padding: { left: 4, right: 4 }, // Default in rich.Panel
  backgroundColor: '#272822', // Default background color in Panel(Syntax()) usage in theme=monokai
});

const title = 'Greeting';
const style = '#d4b702';
const anotherShit = boxen(highlightedCode, {
  title: `${title}`,
  titleAlignment: 'left', // Review
  padding: { left: 1, right: 1 },
  borderStyle: {
    top: '─',
    bottom: '─',
    left: '',
    right: '',
    topLeft: '─',
    topRight: '',
    bottomLeft: '─subtitle',
    bottomRight: '',
  },
  float: 'left',
  backgroundColor: '#272822', // Default background color in Panel(Syntax()) usage in theme=monokai
  width: globalThis?.process?.stdout?.columns,
});

console.log(anotherShit, '\n\n _____END_____\n\n');

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.printf(info => {
    return typeof info.message === 'string' ? info.message : JSON.stringify(info.message);
  }),
  transports: [new winston.transports.Console()],
});

logger.log({
  level: 'info',
  message: anotherShit,
});
