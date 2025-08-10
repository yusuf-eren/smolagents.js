import { Model } from '@/models/base';
import { type ModelConfig } from '@/models';
import { TokenUsage } from '@/monitoring';
import { ChatMessage, ChatMessageStreamDelta } from '@/models/chat-message';
import { MessageRole, type GenerateParams } from '@/models/types';
import { AgentLogger, LogLevel } from '@/monitoring';

export interface OllamaModelConfig extends ModelConfig {
  baseUrl?: string; // e.g., 'http://localhost:11434'
  modelName?: string; // Ollama model name (e.g., 'mistral', 'llama2', 'codellama')
  temperature?: number; // Controls randomness (0-1). Lower values (0.1-0.3) are better for tool calling consistency
  top_p?: number;
  num_predict?: number;
  top_k?: number;
  repeat_penalty?: number;
  seed?: number;
  stop?: string[];
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaStreamResponse {
  model: string;
  created_at: string;
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaModel extends Model {
  private baseUrl: string;
  private modelName: string;
  private temperature: number | undefined;
  private top_p: number | undefined;
  private num_predict: number | undefined;
  private top_k: number | undefined;
  private repeat_penalty: number | undefined;
  private seed: number | undefined;
  private stop: string[] | undefined;
  private logger: AgentLogger;

  /**
   * Creates a new OllamaModel instance
   *
   * @param config - Configuration options for the Ollama model
   * @param config.baseUrl - Ollama server URL (default: 'http://localhost:11434')
   * @param config.modelName - Model name to use (default: 'mistral')
   * @param config.temperature - Sampling temperature 0-1, lower values for more consistent tool calling (default: 0.2)
   * @param config.top_p - Top-p sampling parameter
   * @param config.num_predict - Maximum tokens to generate
   * @param config.top_k - Top-k sampling parameter
   * @param config.repeat_penalty - Repetition penalty
   * @param config.seed - Random seed for reproducible outputs
   * @param config.stop - Stop sequences to end generation
   */
  constructor({
    baseUrl = 'http://localhost:11434',
    modelName = 'mistral',
    temperature = 0.1, // Default temperature is set to a low number to reduce errors via random texts
    top_p,
    num_predict,
    top_k,
    repeat_penalty,
    seed,
    stop,
    ...rest
  }: OllamaModelConfig) {
    super({ modelId: modelName, ...rest });

    this.baseUrl = baseUrl;
    this.modelName = modelName;
    this.temperature = temperature;
    this.top_p = top_p;
    this.num_predict = num_predict;
    this.top_k = top_k;
    this.repeat_penalty = repeat_penalty;
    this.seed = seed;
    this.stop = stop;
    this.logger = new AgentLogger(LogLevel.INFO);
  }

  /**
   * Transform SmolaAgents messages to Ollama format and handle tool calling
   * Converts message formats and adds system prompts for tool calling when tools are available.
   * Ensures proper formatting for tool execution by providing clear JSON examples.
   *
   * @param messages - Array of chat messages to transform
   * @param toolsToCallFrom - Optional array of available tools for tool calling
   * @returns Transformed messages in Ollama format
   */
  public transformMessages(messages: any[], toolsToCallFrom?: any[]): any[] {
    const transformedMessages = messages.map(msg => ({
      role:
        msg.role === MessageRole.ASSISTANT
          ? 'assistant'
          : msg.role === MessageRole.USER
            ? 'user'
            : msg.role === MessageRole.SYSTEM
              ? 'system'
              : 'user',
      content:
        typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((c: any) => c.text || c).join(' ')
            : String(msg.content),
    }));

    // If tools are available, add system message with tool calling instructions
    if (toolsToCallFrom && toolsToCallFrom.length > 0) {
      const toolDescriptions = toolsToCallFrom
        .map(
          tool =>
            `- ${tool.function?.name || tool.name}: ${tool.function?.description || tool.description}`
        )
        .join('\n');


        //TODO: Will take this to a .yaml like file with betterly written prompt or use default system prompt
        // We need another system message aside from agent as ollama does not natively support tool calling similar to the way other models do.
      const toolCallSystemMessage = {
        role: 'system',
        content: `You are an AI assistant with access to the following tools:

          ${toolDescriptions}

          IMPORTANT RULES:
          1. Call ONLY ONE tool at a time
          2. When you need to use a tool, respond with EXACTLY this JSON format:
          {
            "name": "tool_name",
            "arguments": {"param1": "value1", "param2": "value2"}
          }

          3. Do NOT include multiple tool calls in one response
          4. Do NOT add any text before or after the JSON
          5. For regular conversation (non-tool responses), answer normally without JSON

          Example good tool call:
          {
            "name": "get_weather",
            "arguments": {"city": "Paris"}
          }

          Example BAD (multiple tools):
          {
            "name": "get_weather",
            "arguments": {"city": "Paris"}
          },
          {
            "name": "get_time", 
            "arguments": {"city": "Paris"}
          }

          If you need multiple tools, the system will call you again after the first tool completes.`,
      };

      // Insert the system message at the beginning (after any existing system messages)
      const firstNonSystemIndex = transformedMessages.findIndex(msg => msg.role !== 'system');
      if (firstNonSystemIndex === -1) {
        transformedMessages.push(toolCallSystemMessage);
      } else {
        transformedMessages.splice(firstNonSystemIndex, 0, toolCallSystemMessage);
      }
    }

    return transformedMessages;
  }

  /**
   * Create the request options for Ollama API
   *
   * Builds configuration object with sampling parameters for model generation.
   * Only includes parameters that have been explicitly set to avoid sending undefined values.
   *
   * @returns Configuration object for Ollama API requests
   */
  private createRequestOptions(): Record<string, any> {
    const options: Record<string, any> = {};
    
    if (this.temperature !== undefined) options['temperature'] = this.temperature;
    if (this.top_p !== undefined) options['top_p'] = this.top_p;
    if (this.num_predict !== undefined) options['num_predict'] = this.num_predict;
    if (this.top_k !== undefined) options['top_k'] = this.top_k;
    if (this.repeat_penalty !== undefined) options['repeat_penalty'] = this.repeat_penalty;
    if (this.seed !== undefined) options['seed'] = this.seed;
    if (this.stop !== undefined) options['stop'] = this.stop;

    return options;
  }

  /**
   * Check if Ollama server is running and model is available
   *
   * Queries the Ollama server to verify connectivity and that the specified model
   * is available locally. Used for health checks before making generation requests.
   *
   * @returns Promise that resolves to true if server is healthy and model is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return false;

      const data = await response.json();
      const models = data.models || [];
      return models.some((model: any) => model.name.includes(this.modelName));
    } catch (error) {
      return false;
    }
  }

  /**
   * Pull a model if it's not available locally
   *
   * Downloads the specified model from Ollama's model registry if it's not already
   * available locally. This is automatically called when a model is not found during
   * generation requests.
   *
   * @throws Error if the model cannot be pulled or the request fails
   */
  async pullModel(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.modelName }),
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model ${this.modelName}: ${response.statusText}`);
      }

      // Read the stream to completion
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }
    } catch (error) {
      throw new Error(`Failed to pull Ollama model: ${error}`);
    }
  }

  override async generate(params: GenerateParams): Promise<ChatMessage> {
    // Check if server is running and model is available
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      this.logger.console.log(
        LogLevel.INFO,
        `Ollama model ${this.modelName} not found locally. Attempting to pull...`
      );
      await this.pullModel();
    }

    const completionParams = await this.prepareCompletionParams({
      messages: params.messages,
      stopSequences: params.stopSequences ?? null,
      responseFormat: params.responseFormat ?? null,
      toolsToCallFrom: params.toolsToCallFrom ?? null,
      modelId: this.modelId ?? this.modelName,
    });

    const transformedMessages = this.transformMessages(
      completionParams['messages'],
      completionParams['tools']
    );
    const requestOptions = this.createRequestOptions();

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: transformedMessages,
          stream: false,
          options: requestOptions,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data: OllamaResponse = await response.json();

      // Extract token usage information if available
      const inputTokens = data.prompt_eval_count || 0;
      const outputTokens = data.eval_count || 0;

      // Update token counts for monitoring
      this._lastInputTokenCount = inputTokens;
      this._lastOutputTokenCount = outputTokens;

      return new ChatMessage({
        role: MessageRole.ASSISTANT,
        content: data.message.content,
        raw: data,
        tokenUsage: new TokenUsage(inputTokens, outputTokens),
      });
    } catch (error) {
      throw new Error(`Ollama generation failed: ${error}`);
    }
  }

  /**
   * Override parseToolCalls to provide better error handling for Ollama
   *
   * Implements robust JSON extraction from mixed-content responses that Ollama models
   * often generate. Uses brace counting to properly extract complete JSON objects
   * and provides detailed error reporting for debugging tool calling issues.
   *
   * @param message - The chat message containing potential tool call JSON
   * @returns Parsed message with tool call information
   * @throws Error with detailed debugging information if parsing fails
   */
  override parseToolCalls(message: ChatMessage): ChatMessage {
    const content = typeof message.content === 'string' ? message.content : String(message.content);

    /**
     * Extract JSON tool call from mixed text content
     * Uses brace counting to handle nested objects properly
     */
    const extractToolCallJson = (text: string): string | null => {
      // Find the start of JSON object
      const startIndex = text.indexOf('{');
      if (startIndex === -1) return null;

      let braceCount = 0;
      let endIndex = startIndex;

      // Count braces to find the complete JSON object
      for (let i = startIndex; i < text.length; i++) {
        if (text[i] === '{') braceCount++;
        if (text[i] === '}') braceCount--;

        if (braceCount === 0) {
          endIndex = i;
          break;
        }
      }

      if (braceCount === 0) {
        const jsonCandidate = text.substring(startIndex, endIndex + 1);
        // Verify it contains required tool call fields
        if (jsonCandidate.includes('"name"') && jsonCandidate.includes('"arguments"')) {
          return jsonCandidate;
        }
      }

      return null;
    };

    const extractedJson = extractToolCallJson(content);

    if (extractedJson) {
      this.logger.console.log(LogLevel.DEBUG, `Extracted tool call JSON: ${extractedJson}`);

      // Create a new message with cleaned content
      const cleanedMessage = new ChatMessage({
        role: message.role,
        content: extractedJson,
        raw: message.raw,
        tokenUsage: message.tokenUsage,
      });

      try {
        return super.parseToolCalls(cleanedMessage);
      } catch (parseError) {
        this.logger.console.log(LogLevel.ERROR, `Failed to parse extracted JSON: ${parseError}`);
        this.logger.console.log(LogLevel.DEBUG, `Extracted content was: ${extractedJson}`);
      }
    }

    // If JSON extraction failed, try the original parsing
    try {
      return super.parseToolCalls(message);
    } catch (error) {
      // If tool call parsing fails, provide a helpful error message
      this.logger.console.log(
        LogLevel.ERROR,
        `Ollama tool call parsing failed. Raw response: ${content.substring(0, 300)}`
      );
      this.logger.console.log(
        LogLevel.INFO,
        'Tip: Ollama models need clear instruction to output ONLY JSON format for tool calls.'
      );

      // Try to extract any JSON-like content and suggest fixes
      if (content.includes('{') && content.includes('}')) {
        this.logger.console.log(
          LogLevel.DEBUG,
          'Found JSON-like content but parsing failed. The model may be adding extra text.'
        );
      } else {
        this.logger.console.log(
          LogLevel.DEBUG,
          'No JSON detected. The model may not understand tool calling format.'
        );
      }

      throw new Error(
        `Ollama tool call parsing failed. The model response was: "${content.substring(0, 200)}...". ` +
          'Make sure your Ollama model supports function calling or try a different model like mistral:instruct or llama3.'
      );
    }
  }

  /**
   * Generate streaming response from Ollama model
   *
   * Provides real-time streaming of model responses with automatic model pulling
   * if the model is not available locally. Supports the same parameters as generate()
   * but returns an async generator for progressive response handling.
   *
   * @param params - Generation parameters including messages and tools
   * @yields ChatMessageStreamDelta objects with incremental response content
   */
  override async *generateStream(params: GenerateParams): AsyncGenerator<ChatMessageStreamDelta> {
    // Check if server is running and model is available
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      this.logger.console.log(
        LogLevel.INFO,
        `Ollama model ${this.modelName} not found locally. Attempting to pull...`
      );
      await this.pullModel();
    }

    const completionParams = await this.prepareCompletionParams({
      messages: params.messages,
      stopSequences: params.stopSequences ?? null,
      responseFormat: params.responseFormat ?? null,
      toolsToCallFrom: params.toolsToCallFrom ?? null,
      modelId: this.modelId ?? this.modelName,
    });

    const transformedMessages = this.transformMessages(
      completionParams['messages'],
      completionParams['tools']
    );
    const requestOptions = this.createRequestOptions();

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: transformedMessages,
          stream: true,
          options: requestOptions,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response stream reader');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data: OllamaStreamResponse = JSON.parse(line);

                if (data.message?.content) {
                  yield new ChatMessageStreamDelta({
                    content: data.message.content,
                  });
                }

                // Handle final response with token usage
                if (data.done && data.eval_count) {
                  this._lastInputTokenCount = data.prompt_eval_count || 0;
                  this._lastOutputTokenCount = data.eval_count || 0;

                  yield new ChatMessageStreamDelta({
                    content: '',
                    tokenUsage: new TokenUsage(
                      this._lastInputTokenCount,
                      this._lastOutputTokenCount
                    ),
                  });
                }
              } catch (parseError) {
                console.warn('Failed to parse Ollama stream response:', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      throw new Error(`Ollama streaming failed: ${error}`);
    }
  }
}
