/**
 * TypeScript definitions for Chrome Built-in AI APIs (Gemini Nano on-device)
 * Standards based on WICG Prompt API & Chrome Built-in AI proposals.
 */

export type AICapabilityAvailability = 'readily' | 'after-download' | 'no';

export interface AICapabilities {
  available: AICapabilityAvailability;
  defaultTemperature?: number;
  defaultTopK?: number;
  maxTopK?: number;
}

export interface AILanguageModelPromptOptions {
  signal?: AbortSignal;
}

export interface AILanguageModelCloneOptions {
  signal?: AbortSignal;
}

export interface AILanguageModelCreateOptions {
  signal?: AbortSignal;
  systemPrompt?: string;
  initialPrompts?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  topK?: number;
  monitor?: (monitor: AICreateMonitor) => void;
}

export interface AICreateMonitor extends EventTarget {
  ondownloadprogress?: (event: { loaded: number; total: number }) => void;
}

export interface AILanguageModel {
  prompt(input: string, options?: AILanguageModelPromptOptions): Promise<string>;
  promptStreaming(
    input: string,
    options?: AILanguageModelPromptOptions
  ): ReadableStream<string>;
  countPromptTokens(
    input: string,
    options?: AILanguageModelPromptOptions
  ): Promise<number>;
  maxTokens: number;
  tokensSoFar: number;
  tokensLeft: number;
  topK: number;
  temperature: number;
  clone(options?: AILanguageModelCloneOptions): Promise<AILanguageModel>;
  destroy(): void;
}

export interface AILanguageModelFactory {
  capabilities(): Promise<AICapabilities>;
  create(options?: AILanguageModelCreateOptions): Promise<AILanguageModel>;
}

export interface AISummarizerCapabilities {
  available: AICapabilityAvailability;
}

export interface AISummarizerCreateOptions {
  type?: 'key-points' | 'tl;dr' | 'teaser' | 'headline';
  format?: 'plain-text' | 'markdown';
  length?: 'short' | 'medium' | 'long';
  sharedContext?: string;
  signal?: AbortSignal;
  monitor?: (monitor: AICreateMonitor) => void;
}

export interface AISummarizer {
  summarize(text: string, options?: { context?: string; signal?: AbortSignal }): Promise<string>;
  summarizeStreaming(
    text: string,
    options?: { context?: string; signal?: AbortSignal }
  ): ReadableStream<string>;
  destroy(): void;
}

export interface AISummarizerFactory {
  capabilities(): Promise<AISummarizerCapabilities>;
  create(options?: AISummarizerCreateOptions): Promise<AISummarizer>;
}

export interface AIRewriterCapabilities {
  available: AICapabilityAvailability;
}

export interface AIRewriterCreateOptions {
  tone?: 'as-is' | 'more-formal' | 'more-casual';
  format?: 'as-is' | 'plain-text' | 'markdown';
  length?: 'as-is' | 'shorter' | 'longer';
  sharedContext?: string;
  signal?: AbortSignal;
  monitor?: (monitor: AICreateMonitor) => void;
}

export interface AIRewriter {
  rewrite(text: string, options?: { context?: string; signal?: AbortSignal }): Promise<string>;
  rewriteStreaming(
    text: string,
    options?: { context?: string; signal?: AbortSignal }
  ): ReadableStream<string>;
  destroy(): void;
}

export interface AIRewriterFactory {
  capabilities(): Promise<AIRewriterCapabilities>;
  create(options?: AIRewriterCreateOptions): Promise<AIRewriter>;
}

export interface AIWriterCapabilities {
  available: AICapabilityAvailability;
}

export interface AIWriterCreateOptions {
  tone?: 'formal' | 'casual' | 'neutral';
  format?: 'plain-text' | 'markdown';
  length?: 'short' | 'medium' | 'long';
  sharedContext?: string;
  signal?: AbortSignal;
  monitor?: (monitor: AICreateMonitor) => void;
}

export interface AIWriter {
  write(prompt: string, options?: { context?: string; signal?: AbortSignal }): Promise<string>;
  writeStreaming(
    prompt: string,
    options?: { context?: string; signal?: AbortSignal }
  ): ReadableStream<string>;
  destroy(): void;
}

export interface AIWriterFactory {
  capabilities(): Promise<AIWriterCapabilities>;
  create(options?: AIWriterCreateOptions): Promise<AIWriter>;
}

export interface AITranslatorCapabilities {
  available: AICapabilityAvailability;
  languagePairAvailable(sourceLanguage: string, targetLanguage: string): AICapabilityAvailability;
}

export interface AITranslatorCreateOptions {
  sourceLanguage: string;
  targetLanguage: string;
  signal?: AbortSignal;
  monitor?: (monitor: AICreateMonitor) => void;
}

export interface AITranslator {
  translate(input: string, options?: { signal?: AbortSignal }): Promise<string>;
  translateStreaming(
    input: string,
    options?: { signal?: AbortSignal }
  ): ReadableStream<string>;
  destroy(): void;
}

export interface AITranslatorFactory {
  capabilities(): Promise<AITranslatorCapabilities>;
  create(options: AITranslatorCreateOptions): Promise<AITranslator>;
}

export interface AI {
  languageModel?: AILanguageModelFactory;
  summarizer?: AISummarizerFactory;
  rewriter?: AIRewriterFactory;
  writer?: AIWriterFactory;
  translator?: AITranslatorFactory;
}

declare global {
  interface Window {
    ai?: AI;
  }
}
