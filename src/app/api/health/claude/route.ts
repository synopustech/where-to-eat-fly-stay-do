import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const vllmUrl = process.env.VLLM_URL;
    
    if (!vllmUrl) {
      return NextResponse.json(
        { error: 'VLLM_URL not configured' },
        { status: 400 }
      );
    }

    // Test the vLLM server by listing available models
    const response = await fetch(`${vllmUrl}/v1/models`);
    
    if (!response.ok) {
      throw new Error(`vLLM responded with ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({ 
      status: 'connected', 
      message: 'Local LLM (vLLM) is working',
      models: data.data?.map((m: { id: string }) => m.id) ?? [],
    });

  } catch (error) {
    console.error('vLLM health check failed:', error);
    return NextResponse.json(
      { 
        error: 'vLLM connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
