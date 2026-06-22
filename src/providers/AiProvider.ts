export interface AiProvider {
  readonly name: string;
  classify(message: string): Promise<unknown>;
}
