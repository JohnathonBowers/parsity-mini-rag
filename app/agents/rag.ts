import { AgentRequest, AgentResponse } from './types';
import { openaiClient } from '@/app/libs/openai/openai';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { qdrantClient } from '../libs/qdrant';
import { cohereClient } from '../libs/cohere';

export async function ragAgent(request: AgentRequest): Promise<AgentResponse> {
	const { query } = request;

	const embedding = await openaiClient.embeddings.create({
		model: 'text-embedding-3-small',
		dimensions: 512,
		input: query,
	});

	const linkedInPosts = await qdrantClient.search('linkedin_posts', {
		vector: embedding.data[0].embedding,
		limit: 10,
		with_payload: true,
	});

	const articles = await qdrantClient.search('medium_articles', {
		vector: embedding.data[0].embedding,
		limit: 10,
		with_payload: true,
	});

	console.log('linkedInPosts', JSON.stringify(linkedInPosts, null, 2));
	console.log('articles', JSON.stringify(articles, null, 2));

	const rerankedDocuments = await cohereClient.rerank({
		model: 'rerank-english-v3.0',
		query: query,
		documents: [
			...linkedInPosts.map((post) => post.payload?.content as string),
			...articles.map((article) => article.payload?.content as string),
		],
		topN: 10,
		returnDocuments: true,
	});

	console.log(
		'rerankedDocuments',
		JSON.stringify(rerankedDocuments, null, 2)
	);

	// we want to generate a linkedin post based on a user query
	return streamText({
		model: openai('gpt-5'),
		messages: [
			{
				role: 'system',
				content: `
				Generate a LinkedIn post based on a user query.
				Use the style, tone and experiences from these documents to generate the post.
				Documents: ${JSON.stringify(
					rerankedDocuments.results.map(
						(result) => result.document?.text
					),
					null,
					2
				)}
				`,
			},
			{
				role: 'user',
				content: query,
			},
		],
		temperature: 0.8,
	});
}