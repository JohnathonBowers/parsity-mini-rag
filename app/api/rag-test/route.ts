import { openaiClient } from '@/app/libs/openai/openai';
import { qdrantClient } from '@/app/libs/qdrant';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { query, topK } = body; // write an article on x

    // they take the top K results from your search and return them

    // generate the embedding for the query
    const embedding = await openaiClient.embeddings.create({
        model: 'text-embedding-3-small',
        dimensions: 512,
        input: query,
    });

    // query qdrant for the top K results
    const results = await qdrantClient.search('medium_articles', {
        vector: embedding.data[0].embedding,
        limit: topK,
        with_payload: true,
    });

    console.log(JSON.stringify(results, null, 2));
}
