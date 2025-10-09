import { AgentRequest, AgentResponse } from './types';
import { pineconeClient } from '@/app/libs/pinecone';
import { openaiClient } from '@/app/libs/openai/openai';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function ragAgent(request: AgentRequest): Promise<AgentResponse> {
	const embeddingResponse = await openaiClient.embeddings.create({
		model: 'text-embedding-3-small',
		dimensions: 512,
		input: request.query,
	});

	const embedding = embeddingResponse.data[0].embedding;

	const index = pineconeClient.Index(process.env.PINECONE_INDEX!);

	const queryResponse = await index.query({
		vector: embedding,
		topK: 10,
		includeMetadata: true,
	});

	const documents = queryResponse.matches
		.map((match) => match.metadata?.text ?? match.metadata?.content)
		.filter(Boolean);

	const reranked = await pineconeClient.inference.rerank(
		'bge-reranker-v2-m3',
		request.query,
		documents as string[]
	);

	const retrievedContext = reranked.data
		.map((result) => result.document?.text)
		.filter(Boolean)
		.join('\n\n');

	const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.

Original user request: "${request.originalQuery}"
Refined query: "${request.query}"

Context from documentation:
${retrievedContext}

Use the context above to answer the user's question. If the context doesn't contain enough information, say so clearly.`;

	return streamText({
		model: openai('gpt-4o'),
		system: systemPrompt,
		messages: request.messages,
	});
}
