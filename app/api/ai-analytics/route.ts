import { NextRequest, NextResponse } from 'next/server';
import groq from '@/lib/groq';

export async function POST(request: NextRequest) {
  try {
    const { query, data } = await request.json();

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 });
    }

    const messages = [
      {
        role: 'system' as const,
        content: `You are a business intelligence analyst for "Global Essentials", a POS and debt management system.
Answer questions about the business data provided. Be concise, insightful, and actionable.
Format your response nicely with bullet points or sections when appropriate.
Keep responses under 300 words.`,
      },
      {
        role: 'user' as const,
        content: `Business Data:
- Total Revenue: $${data.totalRevenue.toFixed(2)}
- Total Expenses: $${data.totalExpenses.toFixed(2)}
- Net Profit: $${data.netProfit.toFixed(2)}
- Ground Truth (Paid Sales - Expenses): $${data.groundTruth.toFixed(2)}
- In Pipeline (Unpaid Installments): $${data.inPipeline.toFixed(2)}
- Top Products: ${data.topProducts.map((p: any) => `${p.name} (${p.count} sold, $${p.revenue.toFixed(2)} revenue)`).join(', ') || 'None yet'}
- Last 7 Days Revenue: ${data.revenueByDay.map((d: any) => `${d.date}: $${d.amount.toFixed(2)}`).join(', ') || 'No data'}

Question: ${query}`,
      },
    ];

    const response = await groq.chat.completions.create({
      messages: messages as any,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      max_tokens: 1024,
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