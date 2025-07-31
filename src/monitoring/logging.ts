import boxen, { type Options as BoxenOptions } from 'boxen';
import Table from 'cli-table3';
import readline from 'readline';
import * as ch from 'cli-highlight';
import winston from 'winston';

import { group, panel, rule } from '@/monitoring/helpers';
import {
  LogLevel,
  LogLevelNumber,
  YELLOW_HEX,
  javascriptTheme,
  type LogCodeInputParams,
  type LogInputParams,
  type LogMarkdownInputParams,
  type LogMessagesInputParams,
  type LogRuleInputParams,
  type LogTaskInputParams,
} from '@/monitoring/types';
import { escapeCodeBrackets } from '@/utils';
import chalk from 'chalk';
import type { Tool } from '@/tools';

/**
 * Contains the timing information for a given step or run.
 */
export class Timing {
  startTime: number;
  endTime: number | undefined;

  constructor(startTime: number, endTime?: number) {
    this.startTime = startTime;
    this.endTime = endTime;
  }

  get duration(): number | undefined {
    return this.endTime ? this.endTime - this.startTime : undefined;
  }

  toJSON(): { startTime: number; endTime: number | undefined; duration: number | undefined } {
    return {
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
    };
  }
}

export const logger = winston.createLogger({
  levels: {
    off: LogLevelNumber.OFF,
    error: LogLevelNumber.ERROR,
    info: LogLevelNumber.INFO,
    debug: LogLevelNumber.DEBUG,
  },
  level: LogLevel.INFO,
  format: winston.format.combine(
    winston.format(info => {
      if (info.level === 'off') return false;
      return info;
    })(),
    winston.format.printf(info => {
      return typeof info.message === 'string' ? info.message : JSON.stringify(info.message);
    })
  ),
  transports: [new winston.transports.Console()],
});

export class AgentLogger {
  level: LogLevel;
  console: winston.Logger = logger;

  // TODO: Review console parameter.
  constructor(level: LogLevel = LogLevel.INFO, console?: winston.Logger) {
    this.level = level;
    if (console) {
      this.console = console;
    }
  }

  /**
   * Logs a message to the console.
   *
   * @param args - The message to log.
   * @param level - The log level. Defaults to LogLevel.INFO.
   * @param kwargs - The keyword arguments to log.
   */
  log(args: string, { level = LogLevel.INFO, ...kwargs }: LogInputParams = {}): void {
    this.console.log({
      level: level,
      message: args,
      ...kwargs,
    });
  }

  // DONE
  logError(errorMessage: string): void {
    this.log(escapeCodeBrackets(errorMessage), {
      level: LogLevel.ERROR,
    });
  }

  // DONE
  logMarkdown({
    content,
    title,
    level = LogLevel.INFO,
    style = YELLOW_HEX,
  }: LogMarkdownInputParams): void {
    const markdownContent = ch.highlight(content, {
      language: 'markdown',
    });

    // Boxing for adding background color to the markdown content.
    // It improves readability of the markdown content.
    const boxedMarkdownContent = boxen(markdownContent, {
      titleAlignment: 'center',
      padding: { left: 4, right: 4 },
      borderStyle: 'none',
      backgroundColor: '#0c1116',
      width: globalThis?.process?.stdout?.columns,
    });

    if (title) {
      const groupedLog = group([
        rule({ title, bold: true, italic: true, borderColor: style }),
        boxedMarkdownContent,
      ]);

      this.log(groupedLog, { level });
    } else {
      this.log(markdownContent, { level });
    }
  }

  // DONE
  logCode({ title, content, level = LogLevel.INFO }: LogCodeInputParams): void {
    const highlightedCode = ch.highlight(content, {
      language: 'javascript',
      theme: ch.fromJson(javascriptTheme),
    });

    const boxedCode = boxen(highlightedCode, {
      title: title,
      titleAlignment: 'left',
      padding: { left: 4, right: 4 },
      borderStyle: {
        top: '─',
        bottom: '─',
        left: '',
        right: '',
        topLeft: '─',
        topRight: '',
        bottomLeft: '',
        bottomRight: '',
      },
      float: 'left',
      backgroundColor: '#272822', // Default background color in Panel(Syntax()) usage in theme=monokai
      width: globalThis?.process?.stdout?.columns,
    });

    this.log(boxedCode, { level });
  }

  // DONE
  logRule({ title, level = LogLevel.INFO }: LogRuleInputParams): void {
    this.log(rule({ title, bold: true, borderColor: YELLOW_HEX }), { level });
  }

  // DONE
  logTask({ content, title, subtitle, level = LogLevel.INFO }: LogTaskInputParams): void {
    const taskTitle = title.length > 0 ? ` - ${title}` : '';
    this.log(
      panel(
        { content, title: chalk.bold('New run' + taskTitle), subtitle },
        { borderColor: YELLOW_HEX, contentStyle: 'bold', titleStyle: 'bold', subtitleStyle: 'bold' }
      ),
      { level }
    );
  }

  // DONE
  logMessages({ messages, level = LogLevel.INFO }: LogMessagesInputParams): void {
    const messagesString = messages
      .map(message => JSON.stringify({ ...message }, null, 2))
      .join('\n');

    const highlightedMessages = ch.highlight(messagesString, {
      language: 'markdown',
    });

    this.log(highlightedMessages, { level });
  }

  // TODO: Complete this function after Agent and Tool classes are implemented.
  // TODO: Add Agent Type
  visualizeAgentTree(agent: any) {
    const lines: string[] = [];

    const getAgentHeadline = (agent: any, name?: string) => {
      const nameHeadline = name ? `${name} | ` : '';
      return chalk
        .hex(YELLOW_HEX)
        .bold(`${nameHeadline}${agent.constructor.name} | ${agent.model.modelId}`);
    };

    const createToolsSection = (tools: Record<string, Tool>) => {
      const table = new Table({
        head: ['Name', 'Description', 'Arguments'],
        style: { head: ['cyan'], border: [] },
        wordWrap: true,
        colWidths: [20, 40, 60],
      });

      for (const [name, tool] of Object.entries(tools)) {
        const args = Object.entries(tool.inputs || {})
          .map(([argName, info]: any) => {
            const type = Array.isArray(info.type) ? info.type.join('|') : info.type || 'Any';
            const optional = info.optional ? ', optional' : '';
            return `${argName} (\`${type}\`${optional}): ${info.description ?? ''}`;
          })
          .join('\n');
        table.push([name, tool.description ?? String(tool), args]);
      }

      return [`🛠️ ${chalk.italic.hex('#1E90FF')('Tools:')}`, table.toString()];
    };

    const buildAgentTree = (agent: any, prefix = '') => {
      const indent = (text: string, depth: number) => '  '.repeat(depth) + text;

      const toolSection = createToolsSection(agent.tools);
      lines.push(indent(toolSection[0] ?? '', prefix.length / 2));
      lines.push(indent(toolSection[1] ?? '', prefix.length / 2));

      if (agent.managedAgents) {
        lines.push(
          indent('🤖 ' + chalk.italic.hex('#1E90FF')('Managed agents:'), prefix.length / 2)
        );
        for (const [name, managed_agent] of Object.entries(agent.managedAgents) as any) {
          const header = getAgentHeadline(managed_agent, name);
          lines.push(indent(header, prefix.length / 2 + 1));
          if (managed_agent.constructor.name === 'CodeAgent') {
            lines.push(
              indent(
                `✅ ${chalk.italic.hex('#1E90FF')('Authorized imports:')} ${managed_agent.additionalAuthorizedImports.join(', ')}`,
                prefix.length / 2 + 2
              )
            );
          }
          lines.push(
            indent(
              `📝 ${chalk.italic.hex('#1E90FF')('Description:')} ${managed_agent.description}`,
              prefix.length / 2 + 2
            )
          );
          buildAgentTree(managed_agent, prefix + '  ');
        }
      }
    };

    const mainHeadline = getAgentHeadline(agent);
    lines.push(mainHeadline);
    if (agent.constructor.name === 'CodeAgent') {
      lines.push(
        `✅ ${chalk.italic.hex('#1E90FF')('Authorized imports:')} ${agent.additionalAuthorizedImports.join(', ')}`
      );
    }
    buildAgentTree(agent);

    this.console.info(lines.join('\n'));
  }
}

export class LiveBox {
  logger: AgentLogger;
  boxed: boolean;
  private renderedLineCount = 0;
  private content = '';
  private options: BoxenOptions = {
    padding: 1,
    borderStyle: 'round',
    borderColor: 'yellow',
  };

  constructor(initialContent = '', boxed = true, logger: AgentLogger) {
    this.boxed = boxed;
    this.content = initialContent;
    this.logger = logger;
    this.render();
  }

  update(newContent: string, language: 'json' | 'md' | 'ts' = 'md') {
    this.content = newContent;
    this.render(language);
  }

  private render(language: string = 'md') {
    const terminalWidth = process.stdout.columns ?? 80;
    let content = ch.highlight(this.content, { language, ignoreIllegals: true });
    content = boxen(content, {
      ...this.options,
      width: terminalWidth,
      borderStyle: this.boxed ? 'round' : 'none',
    });

    const lines = content.split('\n');
    const lineCount = lines.length;
    // Move cursor up by previously rendered line count
    if (this.renderedLineCount > 0) {
      readline.moveCursor(process.stdout, 0, -this.renderedLineCount);
      readline.clearScreenDown(process.stdout);
    }

    this.logger.log(content, { level: LogLevel.INFO });
    this.renderedLineCount = lineCount;
  }
}
