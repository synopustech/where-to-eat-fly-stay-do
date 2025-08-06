import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function GET() {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Claude API key not configured' },
        { status: 400 }
      );
    }

    // Test the Claude API with a simple request
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: 'Say "OK" if you can respond.'
        }
      ]
    });

    return NextResponse.json({ 
      status: 'connected', 
      message: 'Claude API is working',
      response: message.content[0]
    });

  } catch (error) {
    console.error('Claude API health check failed:', error);
    return NextResponse.json(
      { 
        error: 'Claude API connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
