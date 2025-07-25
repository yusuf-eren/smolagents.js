import type { JsonTheme } from 'cli-highlight';

export const javascriptTheme: JsonTheme = {
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
  variable: 'red',
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

/**
 * Represents the logging levels for controlling output verbosity.
 * - OFF: No output.
 * - ERROR: Only errors.
 * - INFO: Normal output (default).
 * - DEBUG: Detailed output.
 */
export enum LogLevelNumber {
  OFF = -1,
  ERROR = 0,
  INFO = 1,
  DEBUG = 2,
}

/**
 * Represents the logging levels for controlling output verbosity.
 * - OFF: No output.
 * - ERROR: Only errors.
 * - INFO: Normal output (default).
 * - DEBUG: Detailed output.
 */
export enum LogLevel {
  OFF = 'off',
  ERROR = 'error',
  INFO = 'info',
  DEBUG = 'debug',
}

type WithLevel = { level?: LogLevel };

export interface LogMessagesInputParams extends WithLevel {
  messages: Record<string, any>[];
}

export interface LogTaskInputParams extends WithLevel {
  content: string;
  title: string;
  subtitle: string;
}

export interface LogRuleInputParams extends WithLevel {
  title: string;
}

export interface LogCodeInputParams extends WithLevel {
  title: string;
  content: string;
}

export interface LogMarkdownInputParams extends WithLevel {
  content: string;
  title?: string;
  style?: string;
}

export interface LogInputParams extends WithLevel {
  [key: string]: any;
}

export const YELLOW_HEX = '#d4b702';
