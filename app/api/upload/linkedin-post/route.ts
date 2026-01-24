import { NextRequest, NextResponse } from 'next/server';
import { openaiClient } from '@/app/libs/openai/openai';
import { qdrantClient } from '@/app/libs/qdrant';
import { z } from 'zod';

// Validation schema for LinkedIn post upload
const linkedInPostSchema = z.object({
	text: z.string().min(1, 'Post text is required'),
	author: z.string().min(1, 'Author is required'),
	link: z.string().url('Valid URL is required'),
	date: z.string().min(1, 'Date is required'),
	numReactions: z.number().int().min(0).default(0),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		// Step 1 - Parse and validate the request body
		const post = linkedInPostSchema.parse(body);

		// Step 2 - Generate embedding for the full post (no chunking for LinkedIn posts)
		const embeddingResponse = await openaiClient.embeddings.create({
			model: 'text-embedding-3-small',
			dimensions: 512,
			input: post.text,
		});

		// Step 3 - Upsert to Qdrant's linkedin_posts collection
		await qdrantClient.upsert('linkedin_posts', {
			wait: true,
			points: [
				{
					id: crypto.randomUUID(),
					vector: embeddingResponse.data[0].embedding,
					payload: {
						content: post.text,
						author: post.author,
						url: post.link,
						date: post.date,
						likes: post.numReactions,
						contentType: 'linkedin',
					},
				},
			],
		});

		// Step 4 - Return success response
		return NextResponse.json({
			success: true,
			textLength: post.text.length,
			author: post.author,
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

		console.error('Error uploading LinkedIn post:', error);
		return NextResponse.json(
			{
				error: 'Failed to upload LinkedIn post',
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
