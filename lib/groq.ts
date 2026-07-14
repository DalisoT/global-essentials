import Groq from 'groq-sdk';

/**
 * Lazy Groq client. We can't `new Groq({...})` at module-load time because:
 *   1. The Groq SDK throws if `GROQ_API_KEY` is missing or empty
 *   2. Module-load runs during `next build` (collect-page-data) even
 *      for routes that never use Groq
 *
 * The Proxy forwards every property access to the real client, which
 * is only constructed on first use. If `GROQ_API_KEY` is missing at
 * that moment, the error fires — but only for callers that actually
 * try to use the client. Build-time evaluation of unrelated routes
 * no longer crashes.
 */
type GroqClient = InstanceType<typeof Groq>;

let _client: GroqClient | null = null;

function getClient(): GroqClient {
  if (_client) return _client;
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      'GROQ_API_KEY is missing or empty; either set it in .env.local or instantiate the Groq client with an apiKey option.'
    );
  }
  _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return _client;
}

const groq = new Proxy({} as GroqClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default groq;
export { groq };

/** Chat-completions convenience for callers that import this directly. */
export async function generateChatResponse(
  messages: { role: string; content: string }[]
) {
  const response = await getClient().chat.completions.create({
    messages: messages as Groq.Chat.ChatCompletionMessage[],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: 1024,
  });
  return response.choices[0]?.message?.content || '';
}
