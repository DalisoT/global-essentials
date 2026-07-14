import { NextRequest, NextResponse } from 'next/server';
import groq from '@/lib/groq';
import { analytics } from '@/lib/ai/prompts';

export async function POST(request: NextRequest) {
  try {
    const { query, data } = await request.json();

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 });
    }

    const messages = [
      { role: 'system' as const, content: analytics.system },
      {
        role: 'user' as const,
        content: analytics.buildUserMessage({ query, data }),
      },
    ];

    const response = await groq.chat.completions.create({
      messages: messages as any,
      model: analytics.meta.model,
      temperature: analytics.meta.temperature,
      max_tokens: analytics.meta.maxTokens,
    });

    const aiResponse = response.choices[0]?.message?.content?.trim();

    if (!aiResponse) {
      return NextResponse.json({ success: false, error: 'No response from AI' }, { status: 500 });
    }

    return NextResponse.json({ success: true, response: aiResponse });
  } catch (error: any) {
    console.error('AI Analytics Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'AI service unavailable' }, { status: 500 });
  }
}
