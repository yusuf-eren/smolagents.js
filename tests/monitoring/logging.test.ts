import winston from 'winston';
import { mock, type MockProxy } from 'jest-mock-extended';

// Mock external dependencies that cause ES module issues
jest.mock('winston', () => {
  const mockFormat = Object.assign(
    jest.fn(() => jest.fn()),
    {
      combine: jest.fn(),
      printf: jest.fn(),
    }
  );
  
  return {
    createLogger: jest.fn(() => ({
      log: jest.fn(),
    })),
    format: mockFormat,
    transports: {
      Console: jest.fn(),
    },
  };
});

jest.mock('cli-highlight', () => ({
  highlight: jest.fn(),
  fromJson: jest.fn(),
}));

jest.mock('boxen', () => jest.fn());

// Mock chalk to avoid ES module issues but let our helpers run normally
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    bold: (text: string) => text,
    italic: (text: string) => text,
    hex: () => (text: string) => text,
  },
}));

// Don't mock our internal app functions - let them run normally for integration testing

import { Timing, AgentLogger } from '@/monitoring/logging';
import { LogLevel } from '@/monitoring/types';

describe('Timing', () => {
  describe('constructor', () => {
    it('should create timing with only start time', () => {
      const startTime = 1000;
      const timing = new Timing(startTime);
      
      expect(timing.startTime).toBe(startTime);
      expect(timing.endTime).toBeUndefined();
    });

    it('should create timing with start and end time', () => {
      const startTime = 1000;
      const endTime = 2000;
      const timing = new Timing(startTime, endTime);
      
      expect(timing.startTime).toBe(startTime);
      expect(timing.endTime).toBe(endTime);
    });
  });

  describe('duration getter', () => {
    it('should return undefined when endTime is undefined', () => {
      const timing = new Timing(1000);
      
      expect(timing.duration).toBeUndefined();
    });

    it('should calculate correct duration when endTime is set', () => {
      const startTime = 1000;
      const endTime = 3000;
      const timing = new Timing(startTime, endTime);
      
      expect(timing.duration).toBe(2000);
    });

    it('should handle negative duration', () => {
      const startTime = 3000;
      const endTime = 1000;
      const timing = new Timing(startTime, endTime);
      
      expect(timing.duration).toBe(-2000);
    });
  });

  describe('toJSON', () => {
    it('should return correct JSON object with endTime undefined', () => {
      const startTime = 1000;
      const timing = new Timing(startTime);
      const json = timing.toJSON();
      
      expect(json).toEqual({
        startTime: 1000,
        endTime: undefined,
        duration: undefined,
      });
    });

    it('should return correct JSON object with endTime set', () => {
      const startTime = 1000;
      const endTime = 4000;
      const timing = new Timing(startTime, endTime);
      const json = timing.toJSON();
      
      expect(json).toEqual({
        startTime: 1000,
        endTime: 4000,
        duration: 3000,
      });
    });
  });
});

describe('AgentLogger', () => {
  let agentLogger: AgentLogger;
  let mockConsole: MockProxy<winston.Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsole = mock<winston.Logger>();
    agentLogger = new AgentLogger();
    agentLogger.console = mockConsole;

    // Set up mock implementations only for external libraries
    const cliHighlight = jest.requireMock('cli-highlight');
    const boxen = jest.requireMock('boxen');

    cliHighlight.highlight.mockImplementation((content: string) => `highlighted: ${content}`);
    cliHighlight.fromJson.mockReturnValue({
      keyword: (text: string) => text,
      built_in: (text: string) => text,
      string: (text: string) => text,
    });
    boxen.mockImplementation((content: string) => `boxed: ${content}`);
  });

  describe('constructor', () => {
    it('should create with default parameters', () => {
      const logger = new AgentLogger();
      
      expect(logger.level).toBe(LogLevel.INFO);
      expect(logger.console).toBeDefined();
    });

    it('should create with custom level', () => {
      const logger = new AgentLogger(LogLevel.DEBUG);
      
      expect(logger.level).toBe(LogLevel.DEBUG);
    });

    it('should create with custom console logger', () => {
      const customConsole = mock<winston.Logger>();
      const logger = new AgentLogger(LogLevel.ERROR, customConsole);
      
      expect(logger.level).toBe(LogLevel.ERROR);
      expect(logger.console).toBe(customConsole);
    });
  });

  describe('log method', () => {
    it('should log with default parameters', () => {
      const message = 'test message';
      
      agentLogger.log(message);
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message,
      });
    });

    it('should log with custom level', () => {
      const message = 'test message';
      const level = LogLevel.ERROR;
      
      agentLogger.log(message, { level });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level,
        message,
      });
    });

    it('should log with additional kwargs', () => {
      const message = 'test message';
      const extraData = { userId: 123, action: 'test' };
      
      agentLogger.log(message, { ...extraData });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message,
        userId: 123,
        action: 'test',
      });
    });
  });

  describe('logError method', () => {
    it('should log error with escaped message', () => {
      const errorMessage = 'error [code] message';
      
      agentLogger.logError(errorMessage);
      
      // Test the actual escaped output since escapeCodeBrackets runs normally
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.ERROR,
        message: 'error \\[code\\] message',
      });
    });
  });

  describe('logMarkdown method', () => {
    it('should log markdown with title', () => {
      const content = '# Markdown content';
      const title = 'Test Title';
      
      agentLogger.logMarkdown({ content, title });
      
      // Since helpers run normally, test for the actual console output
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: expect.any(String),
      });
    });

    it('should log markdown without title', () => {
      const content = '# Markdown content';
      
      agentLogger.logMarkdown({ content });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: 'highlighted: # Markdown content',
      });
    });

    it('should log markdown with custom level and style', () => {
      const content = '# Markdown content';
      const title = 'Test Title';
      const level = LogLevel.DEBUG;
      const style = '#ff0000';
      
      agentLogger.logMarkdown({ content, title, level, style });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level,
        message: expect.any(String),
      });
    });
  });

  describe('logCode method', () => {
    it('should log code with title', () => {
      const content = 'console.log("hello");';
      const title = 'Code Example';
      
      agentLogger.logCode({ title, content });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: expect.stringContaining('boxed:'),
      });
    });

    it('should log code with custom level', () => {
      const content = 'console.log("hello");';
      const title = 'Code Example';
      const level = LogLevel.DEBUG;
      
      agentLogger.logCode({ title, content, level });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level,
        message: expect.stringContaining('boxed:'),
      });
    });
  });

  describe('logRule method', () => {
    it('should log rule with title', () => {
      const title = 'Test Rule';
      
      agentLogger.logRule({ title });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: expect.any(String),
      });
    });

    it('should log rule with custom level', () => {
      const title = 'Test Rule';
      const level = LogLevel.ERROR;
      
      agentLogger.logRule({ title, level });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level,
        message: expect.any(String),
      });
    });
  });

  describe('logTask method', () => {
    it('should log task with all parameters', () => {
      const content = 'Task content';
      const title = 'Task Title';
      const subtitle = 'Task Subtitle';
      
      agentLogger.logTask({ content, title, subtitle });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: expect.any(String),
      });
    });

    it('should log task with custom level', () => {
      const content = 'Task content';
      const title = 'Task Title';
      const subtitle = 'Task Subtitle';
      const level = LogLevel.DEBUG;
      
      agentLogger.logTask({ content, title, subtitle, level });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level,
        message: expect.any(String),
      });
    });
  });

  describe('logMessages method', () => {
    it('should log messages array', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      
      agentLogger.logMessages({ messages });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: expect.stringContaining('highlighted:'),
      });
    });

    it('should log messages with custom level', () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const level = LogLevel.ERROR;
      
      agentLogger.logMessages({ messages, level });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level,
        message: expect.stringContaining('highlighted:'),
      });
    });

    it('should handle empty messages array', () => {
      const messages: Record<string, any>[] = [];
      
      agentLogger.logMessages({ messages });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: 'highlighted: ',
      });
    });

    it('should handle complex message objects', () => {
      const messages = [
        {
          role: 'user',
          content: 'Hello',
          metadata: { timestamp: '2023-01-01', userId: 123 },
          nested: { data: { value: 'test' } },
        },
      ];
      
      agentLogger.logMessages({ messages });
      
      expect(mockConsole.log).toHaveBeenCalledWith({
        level: LogLevel.INFO,
        message: expect.stringContaining('highlighted:'),
      });
    });
  });
});
