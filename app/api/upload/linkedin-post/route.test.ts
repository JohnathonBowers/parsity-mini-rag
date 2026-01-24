import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the OpenAI client
jest.mock('@/app/libs/openai/openai', () => ({
	openaiClient: {
		embeddings: {
			create: jest.fn().mockResolvedValue({
				data: [{ embedding: new Array(512).fill(0.1) }],
			}),
		},
	},
}));

// Mock the Qdrant client
jest.mock('@/app/libs/qdrant', () => ({
	qdrantClient: {
		upsert: jest.fn().mockResolvedValue({ status: 'completed' }),
	},
}));

// Import mocked modules for assertions
import { openaiClient } from '@/app/libs/openai/openai';
import { qdrantClient } from '@/app/libs/qdrant';

// Helper to create a mock NextRequest
function createMockRequest(body: unknown): NextRequest {
	return new NextRequest('http://localhost:3000/api/upload/linkedin-post', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

describe('POST /api/upload/linkedin-post', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('Successful Uploads', () => {
		const validPost = {
			text: 'This is a test LinkedIn post with enough content to be meaningful. It discusses career advice and tech industry insights.',
			author: 'Test Author',
			link: 'https://linkedin.com/feed/update/urn:li:activity:1234567890',
			date: '2024-01-15 10:30:00',
			numReactions: 42,
		};

		test('should successfully upload a valid post', async () => {
			const req = createMockRequest(validPost);
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.textLength).toBe(validPost.text.length);
			expect(data.author).toBe(validPost.author);
		});

		test('should use default numReactions when not provided', async () => {
			const postWithoutReactions = {
				text: validPost.text,
				author: validPost.author,
				link: validPost.link,
				date: validPost.date,
			};
			const req = createMockRequest(postWithoutReactions);
			await POST(req);

			const upsertCall = (qdrantClient.upsert as jest.Mock).mock.calls[0];
			expect(upsertCall[1].points[0].payload.likes).toBe(0);
		});

		test('should accept zero numReactions', async () => {
			const postWithZeroReactions = { ...validPost, numReactions: 0 };
			const req = createMockRequest(postWithZeroReactions);
			const response = await POST(req);

			expect(response.status).toBe(200);
		});

		test('should upsert to linkedin_posts collection', async () => {
			const req = createMockRequest(validPost);
			await POST(req);

			expect(qdrantClient.upsert).toHaveBeenCalledWith(
				'linkedin_posts',
				expect.any(Object)
			);
		});

		test('should include correct metadata in payload', async () => {
			const req = createMockRequest(validPost);
			await POST(req);

			const upsertCall = (qdrantClient.upsert as jest.Mock).mock.calls[0];
			const payload = upsertCall[1].points[0].payload;

			expect(payload.content).toBe(validPost.text);
			expect(payload.author).toBe(validPost.author);
			expect(payload.url).toBe(validPost.link);
			expect(payload.date).toBe(validPost.date);
			expect(payload.likes).toBe(validPost.numReactions);
			expect(payload.contentType).toBe('linkedin');
		});

		test('should generate embeddings with correct model', async () => {
			const req = createMockRequest(validPost);
			await POST(req);

			expect(openaiClient.embeddings.create).toHaveBeenCalledWith({
				model: 'text-embedding-3-small',
				dimensions: 512,
				input: validPost.text,
			});
		});

		test('should NOT chunk the post (upload full text)', async () => {
			const req = createMockRequest(validPost);
			await POST(req);

			// Should only call upsert once (no chunking)
			expect(qdrantClient.upsert).toHaveBeenCalledTimes(1);

			// Should embed the full text
			expect(openaiClient.embeddings.create).toHaveBeenCalledWith(
				expect.objectContaining({
					input: validPost.text,
				})
			);
		});
	});

	describe('Validation Errors', () => {
		test('should reject missing text', async () => {
			const req = createMockRequest({
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe('Validation failed');
		});

		test('should reject empty text', async () => {
			const req = createMockRequest({
				text: '',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject missing author', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject missing link', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject invalid link format', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				author: 'Test Author',
				link: 'not-a-valid-url',
				date: '2024-01-15',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject missing date', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject negative numReactions', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
				numReactions: -5,
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject non-integer numReactions', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
				numReactions: 42.5,
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject string numReactions', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
				numReactions: 'forty-two',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject completely empty body', async () => {
			const req = createMockRequest({});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});
	});

	describe('Edge Cases', () => {
		test('should handle very long post text', async () => {
			const longText = 'This is a sentence about tech careers. '.repeat(100);
			const req = createMockRequest({
				text: longText,
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
				numReactions: 100,
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.textLength).toBe(longText.length);
		});

		test('should handle text with special characters', async () => {
			const req = createMockRequest({
				text: 'Testing special characters: @#$%^&*()! Does it work? Yes! 🚀🎉💼',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		test('should handle text with hashtags and mentions', async () => {
			const req = createMockRequest({
				text: 'Excited about #JavaScript and #WebDev! Thanks @TechCompany for the opportunity.',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		test('should handle text with newlines', async () => {
			const req = createMockRequest({
				text: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		test('should handle text with URLs', async () => {
			const req = createMockRequest({
				text: 'Check out this article: https://example.com/article?param=value',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		test('should handle large numReactions', async () => {
			const req = createMockRequest({
				text: 'Viral post content here.',
				author: 'Famous Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
				numReactions: 1000000,
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		test('should handle author with special characters', async () => {
			const req = createMockRequest({
				text: 'Test post content.',
				author: "José O'Brien-Smith",
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.author).toBe("José O'Brien-Smith");
		});
	});

	describe('Error Handling', () => {
		test('should handle OpenAI API errors gracefully', async () => {
			(openaiClient.embeddings.create as jest.Mock).mockRejectedValueOnce(
				new Error('OpenAI API error')
			);

			const req = createMockRequest({
				text: 'Test post content.',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe('Failed to upload LinkedIn post');
		});

		test('should handle Qdrant errors gracefully', async () => {
			(qdrantClient.upsert as jest.Mock).mockRejectedValueOnce(
				new Error('Qdrant connection error')
			);

			const req = createMockRequest({
				text: 'Test post content.',
				author: 'Test Author',
				link: 'https://linkedin.com/post/123',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe('Failed to upload LinkedIn post');
		});
	});
});
