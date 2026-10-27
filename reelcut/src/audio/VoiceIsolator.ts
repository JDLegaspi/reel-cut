export interface VoiceIsolator {
  isolate(input: string, output: string): Promise<void>;
}
