export interface AiProvider {
  classify(message: string): Promise<unknown>;
}
