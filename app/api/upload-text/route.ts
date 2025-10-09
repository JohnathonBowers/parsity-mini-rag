import { NextRequest, NextResponse } from 'next/server';
import { chunkText } from '@/app/libs/chunking';
import { openaiClient } from '@/app/libs/openai/openai';
import { pineconeClient } from '@/app/libs/pinecone';

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { text } = body;

		if (!text || typeof text !== 'string') {
			return NextResponse.json(
				{ error: 'Text is required and must be a string' },
				{ status: 400 }
			);
		}

		console.log(`\n📝 Processing raw text (${text.length} chars)...`);

		// Step 1: Chunk the text
		const chunks = chunkText(text, 500, 50, 'user-text');
		console.log(`✅ Created ${chunks.length} chunks`);

		if (chunks.length === 0) {
			return NextResponse.json(
				{ error: 'No chunks created from text' },
				{ status: 400 }
			);
		}

		// Step 2: Generate embeddings for all chunks
		console.log('🔄 Generating embeddings...');
		const embeddingResponse = await openaiClient.embeddings.create({
			model: 'text-embedding-3-small',
			dimensions: 512,
			input: chunks.map((chunk) => chunk.content),
		});

		// Step 3: Prepare vectors for Pinecone
		const vectors = chunks.map((chunk, idx) => ({
			id: chunk.id,
			values: embeddingResponse.data[idx].embedding,
			metadata: {
				text: chunk.content,
				source: 'user-text',
				chunkIndex: chunk.metadata.chunkIndex,
				totalChunks: chunk.metadata.totalChunks,
				startChar: chunk.metadata.startChar,
				endChar: chunk.metadata.endChar,
			},
		}));

		// Step 4: Upload to Pinecone
		console.log('📤 Uploading to Pinecone...');
		const indexName = process.env.PINECONE_INDEX;
		if (!indexName) {
			throw new Error('PINECONE_INDEX environment variable not set');
		}

		const index = pineconeClient.Index(indexName);
		await index.upsert(vectors);

		console.log(`✅ Successfully uploaded ${vectors.length} vectors`);

		return NextResponse.json({
			success: true,
			vectorsUploaded: vectors.length,
			chunksCreated: chunks.length,
			textLength: text.length,
		});
	} catch (error) {
		console.error('Error uploading text:', error);
		return NextResponse.json(
			{
				error: 'Failed to upload text',
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
