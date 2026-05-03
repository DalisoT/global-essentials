import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateChatResponse(messages: { role: string; content: string }[]) {
  const response = await groq.chat.completions.create({
    messages: messages as Groq.Chat.ChatCompletionMessage[],
    model: 'llama-3.3-70b-versatile',
    temperature: 0.7,
    max_tokens: 1024,
  });

  return response.choices[0]?.message?.content || '';
}

export default groq;