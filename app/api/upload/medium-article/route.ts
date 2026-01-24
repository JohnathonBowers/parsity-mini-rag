import { NextRequest, NextResponse } from 'next/server';
import { chunkText } from '@/app/libs/chunking';
import { openaiClient } from '@/app/libs/openai/openai';
import { qdrantClient } from '@/app/libs/qdrant';
import { z } from 'zod';

// Validation schema for Medium article upload
const mediumArticleSchema = z.object({
	text: z.string().min(1, 'Article text is required'),
	title: z.string().min(1, 'Article title is required'),
	url: z.string().url('Valid URL is required'),
	author: z.string().min(1, 'Author is required'),
	date: z.string().min(1, 'Date is required'),
	language: z.string().optional().default('en'),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		// Step 1 - Parse and validate the request body
		const article = mediumArticleSchema.parse(body);

		// Step 2 - Chunk the text content using the article URL as the source identifier
		const chunks = chunkText(article.text, 500, 50, article.url);

		// Step 3 - Check if we got any chunks
		if (chunks.length === 0) {
			return NextResponse.json(
				{ error: 'No chunks created from text' },
				{ status: 400 }
			);
		}

		// Step 4 - Add article metadata to each chunk
		chunks.forEach((chunk) => {
			chunk.metadata.title = article.title;
			chunk.metadata.author = article.author;
			chunk.metadata.date = article.date;
			chunk.metadata.contentType = 'medium';
			chunk.metadata.language = article.language;
		});

		// Step 5 - Generate embeddings and upsert each chunk to Qdrant
		let successCount = 0;

		for (const chunk of chunks) {
			// Generate embedding for this chunk
			const embeddingResponse = await openaiClient.embeddings.create({
				model: 'text-embedding-3-small',
				dimensions: 512,
				input: chunk.content,
			});

			// Upsert to Qdrant's medium_articles collection
			await qdrantClient.upsert('medium_articles', {
				wait: true,
				points: [
					{
						id: crypto.randomUUID(),
						vector: embeddingResponse.data[0].embedding,
						payload: {
							...chunk.metadata,
							content: chunk.content,
						},
					},
				],
			});

			successCount++;
		}

		// Step 6 - Return success response
		return NextResponse.json({
			success: true,
			chunksCreated: chunks.length,
			chunksUploaded: successCount,
			textLength: article.text.length,
			title: article.title,
		});
	} catch (error) {
		// Handle Zod validation errors
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{
					error: 'Validation failed',
					details: error.errors,
				},
				{ status: 400 }
			);
		}

		console.error('Error uploading Medium article:', error);
		return NextResponse.json(
			{
				error: 'Failed to upload Medium article',
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
