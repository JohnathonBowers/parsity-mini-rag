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
	return new NextRequest('http://localhost:3000/api/upload/medium-article', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

describe('POST /api/upload/medium-article', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('Successful Uploads', () => {
		const validArticle = {
			text: 'This is a test article with enough content to be meaningful. It contains multiple sentences to ensure proper chunking. The article discusses important topics that readers will find valuable.',
			title: 'Test Article Title',
			url: 'https://medium.com/test-article',
			author: 'Test Author',
			date: '2024-01-15',
		};

		test('should successfully upload a valid article', async () => {
			const req = createMockRequest(validArticle);
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.chunksCreated).toBeGreaterThan(0);
			expect(data.chunksUploaded).toBeGreaterThan(0);
			expect(data.title).toBe(validArticle.title);
		});

		test('should use default language when not provided', async () => {
			const req = createMockRequest(validArticle);
			await POST(req);

			// Check that qdrantClient.upsert was called with language: 'en'
			expect(qdrantClient.upsert).toHaveBeenCalled();
			const upsertCall = (qdrantClient.upsert as jest.Mock).mock.calls[0];
			expect(upsertCall[1].points[0].payload.language).toBe('en');
		});

		test('should accept custom language', async () => {
			const articleWithLanguage = { ...validArticle, language: 'es' };
			const req = createMockRequest(articleWithLanguage);
			await POST(req);

			const upsertCall = (qdrantClient.upsert as jest.Mock).mock.calls[0];
			expect(upsertCall[1].points[0].payload.language).toBe('es');
		});

		test('should upsert to medium_articles collection', async () => {
			const req = createMockRequest(validArticle);
			await POST(req);

			expect(qdrantClient.upsert).toHaveBeenCalledWith(
				'medium_articles',
				expect.any(Object)
			);
		});

		test('should include correct metadata in payload', async () => {
			const req = createMockRequest(validArticle);
			await POST(req);

			const upsertCall = (qdrantClient.upsert as jest.Mock).mock.calls[0];
			const payload = upsertCall[1].points[0].payload;

			expect(payload.title).toBe(validArticle.title);
			expect(payload.author).toBe(validArticle.author);
			expect(payload.date).toBe(validArticle.date);
			expect(payload.contentType).toBe('medium');
			expect(payload.content).toBeTruthy();
		});

		test('should generate embeddings with correct model', async () => {
			const req = createMockRequest(validArticle);
			await POST(req);

			expect(openaiClient.embeddings.create).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'text-embedding-3-small',
					dimensions: 512,
				})
			);
		});
	});

	describe('Validation Errors', () => {
		test('should reject missing text', async () => {
			const req = createMockRequest({
				title: 'Test Title',
				url: 'https://medium.com/test',
				author: 'Test Author',
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
				title: 'Test Title',
				url: 'https://medium.com/test',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject missing title', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				url: 'https://medium.com/test',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject missing url', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				title: 'Test Title',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject invalid url format', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				title: 'Test Title',
				url: 'not-a-valid-url',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject missing author', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				title: 'Test Title',
				url: 'https://medium.com/test',
				date: '2024-01-15',
			});
			const response = await POST(req);

			expect(response.status).toBe(400);
		});

		test('should reject missing date', async () => {
			const req = createMockRequest({
				text: 'This is test content.',
				title: 'Test Title',
				url: 'https://medium.com/test',
				author: 'Test Author',
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
		test('should handle very long text', async () => {
			const longText = 'This is a sentence. '.repeat(500);
			const req = createMockRequest({
				text: longText,
				title: 'Long Article',
				url: 'https://medium.com/long-article',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
			expect(data.chunksCreated).toBeGreaterThan(1);
		});

		test('should handle text with special characters', async () => {
			const req = createMockRequest({
				text: 'Testing special characters: @#$%^&*()! Does it work? Yes, it does. émojis: 🚀🎉',
				title: 'Special Characters Test',
				url: 'https://medium.com/special',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		test('should handle text with unicode characters', async () => {
			const req = createMockRequest({
				text: '日本語テスト文章です。中文测试内容。한국어 테스트 텍스트.',
				title: 'Unicode Test',
				url: 'https://medium.com/unicode',
				author: 'テスト著者',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		test('should handle text with newlines and whitespace', async () => {
			const req = createMockRequest({
				text: 'First paragraph.\n\nSecond paragraph.\n\n\nThird paragraph with   extra   spaces.',
				title: 'Whitespace Test',
				url: 'https://medium.com/whitespace',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});

		test('should handle url with query parameters', async () => {
			const req = createMockRequest({
				text: 'Test article content here.',
				title: 'URL Test',
				url: 'https://medium.com/article?param=value&other=123',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.success).toBe(true);
		});
	});

	describe('Error Handling', () => {
		test('should handle OpenAI API errors gracefully', async () => {
			(openaiClient.embeddings.create as jest.Mock).mockRejectedValueOnce(
				new Error('OpenAI API error')
			);

			const req = createMockRequest({
				text: 'Test article content.',
				title: 'Test Title',
				url: 'https://medium.com/test',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe('Failed to upload Medium article');
		});

		test('should handle Qdrant errors gracefully', async () => {
			(qdrantClient.upsert as jest.Mock).mockRejectedValueOnce(
				new Error('Qdrant connection error')
			);

			const req = createMockRequest({
				text: 'Test article content.',
				title: 'Test Title',
				url: 'https://medium.com/test',
				author: 'Test Author',
				date: '2024-01-15',
			});
			const response = await POST(req);
			const data = await response.json();

			expect(response.status).toBe(500);
			expect(data.error).toBe('Failed to upload Medium article');
		});
	});
});
