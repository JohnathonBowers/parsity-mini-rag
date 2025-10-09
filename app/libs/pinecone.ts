/**
 * PINECONE VECTOR DATABASE INTEGRATION
 *
 * This file handles interactions with Pinecone, a managed vector database service.
 *
 * WHAT IS A VECTOR DATABASE?
 * Vector databases store high-dimensional numerical representations (embeddings) of data.
 * Unlike traditional databases that store exact text/numbers, vector DBs store "meanings"
 * as mathematical vectors. This enables semantic search - finding content by meaning
 * rather than exact keyword matches.
 *
 *
 * Learn more: https://docs.pinecone.io/docs/overview
 *
 * EXPERIMENT: Try changing the embedding model or topK values below!
 */

import {
	Pinecone,
	RecordMetadata,
	ScoredPineconeRecord,
} from '@pinecone-database/pinecone';
import { openaiClient } from '../libs/openai/openai';

// Initialize Pinecone client with your API key
// Get your free API key at: https://app.pinecone.io/
export const pineconeClient = new Pinecone({
	apiKey: process.env.PINECONE_API_KEY as string,
});

/**
 * Searches for semantically similar documents in the vector database
 *
 * @param query - The search query (will be converted to embeddings)
 * @param topK - Number of most similar results to return (try 3-10)
 * @returns Array of matching documents with similarity scores
 */
export const searchDocuments = async (
	query: string,
	topK: number = 3 // TRY CHANGING: Increase to 5-10 for more results, decrease to 1-2 for fewer
): Promise<ScoredPineconeRecord<RecordMetadata>[]> => {
	// Connect to the  index (collection of vectors)
	const index = pineconeClient.Index(process.env.PINECONE_INDEX!);

	// Convert the search query into a vector embedding using OpenAI
	const queryEmbedding = await openaiClient.embeddings.create({
		model: 'text-embedding-3-small',
		dimensions: 512,
		input: query,
	});

	// Extract the actual embedding array from the API response
	const embedding = queryEmbedding.data[0].embedding;

	// Search the vector database for similar embeddings
	const docs = await index.query({
		vector: embedding,
		topK, // How many results to return
		includeMetadata: true, // Include the original text content with results
	});

	return docs.matches;
};
