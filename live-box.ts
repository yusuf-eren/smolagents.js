import chalk from 'chalk';
import boxen, { Options as BoxenOptions } from 'boxen';
import readline from 'readline';
import { highlight } from 'cli-highlight';

export class LiveBox {
  logger: any;
  private content = '';
  private options: BoxenOptions = {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'yellow',
  };

  constructor(initialContent = '', logger: any) {
    this.content = initialContent;
    this.logger = logger;
    this.render();
  }

  update(newContent: string, language: 'json' | 'md' | 'ts' = 'md') {
    this.content = newContent;
    this.render(language);
  }

  private render(language: string = 'md', boxed: boolean = true) {
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    let content = highlight(this.content, { language, ignoreIllegals: true });
    if (boxed) {
      content = boxen(content, {
        ...this.options,
      });
    }
  }
}

async function* mockModelStream(): AsyncGenerator<{ content: string }> {
  const chunks = [
    'Hello',
    ', ',
    'this ',
    'is ',
    'a ',
    'streamed ',
    'response.',
    'AFAAAH',
    'BANIM ŞU YARAAAA',
  ];
  for (const chunk of chunks) {
    await new Promise(res => setTimeout(res, 300)); // simulate delay
    yield { content: chunk };
  }
}

async function run() {
  const live = new LiveBox('', console);
  let output = '';

  for await (const event of mockModelStream()) {
    output += event.content;
    live.update(output, 'md'); // if it's markdown or plain text
  }

  console.log('\n' + chalk.green('✅ Streaming complete!'));
}

run().catch(console.error);
