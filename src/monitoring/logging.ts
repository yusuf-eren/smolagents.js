import boxen from 'boxen';
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
    this.log(
      panel(
        { content, title, subtitle },
        { borderColor: YELLOW_HEX, contentStyle: 'bold', titleStyle: 'bold', subtitleStyle: 'bold' }
      ),
      { level }
    );
  }

  // DONE
  logMessages({ messages, level = LogLevel.INFO }: LogMessagesInputParams): void {
    const messagesString = messages
      .map(message => JSON.stringify({ ...message }, null, 4))
      .join('\n');

    const highlightedMessages = ch.highlight(messagesString, {
      language: 'markdown',
    });

    this.log(highlightedMessages, { level });
  }

  // TODO: Complete this function after Agent and Tool classes are implemented.
  // TODO: Add Agent Type
  // visualizeAgentTree(agent: Agent) {}
}
