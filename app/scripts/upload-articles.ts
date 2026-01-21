/**
 * Article Upload Script
 *
 * This script processes Medium articles from the data directory,
 * chunks them using the chunking utilities, and uploads them to Qdrant.
 *
 * WORKFLOW:
 * 1. Read all Medium article HTML files from data/articles/
 * 2. Parse them using extractMediumArticle
 * 3. Chunk all content using chunkText
 * 4. Upload to Qdrant
 *
 * USAGE:
 * Run: npx tsx app/scripts/upload-articles.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { qdrantClient } from '../libs/qdrant';
import fs from 'fs';
import path from 'path';
import {
	extractMediumArticle,
	chunkText,
	type Chunk,
} from '../libs/chunking';
import { openaiClient } from '../libs/openai/openai';

const DATA_DIR = path.join(process.cwd(), 'app/scripts/data');
const ARTICLES_DIR = path.join(DATA_DIR, 'articles');

/**
 * Processes all Medium articles from the articles directory
 */
async function processMediumArticles(): Promise<Chunk[]> {
	console.log('📖 Processing Medium articles...');

	const files = fs
		.readdirSync(ARTICLES_DIR)
		.filter((f) => f.endsWith('.html'));
	console.log(`Found ${files.length} HTML files`);

	const allChunks: Chunk[] = [];
	let successCount = 0;
	let failCount = 0;

	for (const file of files) {
		const filePath = path.join(ARTICLES_DIR, file);
		const htmlContent = fs.readFileSync(filePath, 'utf-8');

		// we want to ignore artciles with less than 500 characters
		if (htmlContent.length < 500) {
			continue;
		}

		const article = extractMediumArticle(htmlContent); // removes HTML tags to clean up the text

		if (article) {
			// Chunk the article text (source is set to article.url)
			const chunks = chunkText(article.text, 500, 50, article.url); // breaks article into chunks of 500 characters with 50 character overlap

			console.log(JSON.stringify(chunks, null, 2));

			// Add article metadata to each chunk
			chunks.forEach((chunk) => {
				chunk.metadata.title = article.title;
				chunk.metadata.author = article.author;
				chunk.metadata.date = article.date;
				chunk.metadata.contentType = article.source; // 'medium'
				chunk.metadata.language = article.language;
			});

			allChunks.push(...chunks);
			successCount++;
		} else {
			console.warn(`⚠️  Failed to parse: ${file}`);
			failCount++;
		}
	}

	console.log(
		`✅ Processed ${successCount} articles, ${failCount} failed, ${allChunks.length} total chunks`
	);
	return allChunks;
}

/**
 * Main function
 */
async function main() {
	console.log('🚀 Starting article processing...\n');

	try {
		// Process Medium articles
		const mediumChunks = await processMediumArticles();

		for (const chunk of mediumChunks) {
			// store the embeddings in qdrant
			const embeddings = await openaiClient.embeddings.create({
				model: 'text-embedding-3-small',
				dimensions: 512,
				input: chunk.content,
			});

			await qdrantClient.upsert('medium_articles', {
				wait: true,
				points: [
					{
						id: crypto.randomUUID(),
						vector: embeddings.data[0].embedding,
						payload: {
							...chunk.metadata,
							content: chunk.content,
						},
					},
				],
			});
		}

		console.log(`\n📊 Summary:`);
		console.log(`   Medium chunks: ${mediumChunks.length}`);

		// Save to a JSON file for inspection
		const outputPath = path.join(DATA_DIR, 'processed_chunks.json');
		fs.writeFileSync(outputPath, JSON.stringify(mediumChunks, null, 2));
		console.log(`\n💾 Saved processed chunks to: ${outputPath}`);
	} catch (error) {
		console.error('❌ Error processing articles:', error);
		process.exit(1);
	}
}

main();