# Challenge: Improving Retrieval with Re-ranking

Your RAG agent works, but there's a powerful technique to improve retrieval quality: **re-ranking**.

---

## The Problem

Vector search (Pinecone) is fast and good at finding generally related content, but not always precise:

**Query:** "How to use React hooks with TypeScript"

**Pinecone returns (top 5 by cosine similarity):**

1. "React hooks introduction" - 0.89 ✅ Relevant
2. "TypeScript basics" - 0.87 ⚠️ Not specific enough
3. "Using hooks in React" - 0.86 ✅ Relevant
4. "TypeScript with React" - 0.85 ⚠️ Not about hooks specifically
5. "React hooks patterns" - 0.84 ✅ Relevant

**The issue:** Results 2 and 4 pollute the context with semi-relevant content.

---

## The Solution: Over-Fetch and Re-Rank

**Strategy:**

1. **Over-fetch**: Get more results than you need (e.g., 10 instead of 5)
2. **Re-rank**: Use a specialized model to score relevance more accurately
3. **Keep top N**: Take only the best after re-ranking (e.g., top 3)

```
Pinecone (Vector Search)     Re-ranking Model           Final Context
    10 results         →     Scores each result    →    Top 3 best
  (Fast, broad)              (Slower, accurate)         (High quality)
```

**Why this works:**

-   **Pinecone**: Fast semantic search with good recall (casts a wide net)
-   **Re-ranker**: Deep comparison using cross-attention for precision
-   **Together**: Fast retrieval + accurate ranking = best results

---

## Documentation Resources

Before implementing, review these docs:

**Pinecone Inference API (Re-ranking):**

-   [Re-ranking Guide](https://docs.pinecone.io/guides/inference/rerank) - Complete guide
-   [API Reference](https://docs.pinecone.io/reference/api/inference/rerank) - Re-rank endpoint

**Cohere Re-ranking:**

-   [Cohere Rerank Documentation](https://docs.cohere.com/docs/reranking) - How re-rank models work
-   [Rerank Best Practices](https://docs.cohere.com/docs/reranking-best-practices) - Optimization tips

---

## Your Challenge

Modify your RAG agent (`app/agents/rag.ts`) to use re-ranking.

### Step 1: Over-Fetch

Change your Pinecone query to get more results:

```typescript
const queryResponse = await index.query({
	vector: embedding,
	topK: 10, // Changed from 5 to 10
	includeMetadata: true,
});
```

### Step 2: Re-Rank

After the Pinecone query, add re-ranking:

```typescript
// Re-rank the results using Pinecone's inference API
const documents = queryResponse.matches
	.map((match) => match.metadata?.text ?? match.metadata?.content)
	.filter(Boolean);

const reranked = await pineconeClient.inference.rerank(
	'bge-reranker-v2-m3',
	request.query,
	documents
);
```

### Step 3: Use Re-Ranked Context

Update your context extraction to use re-ranked results:

```typescript
// Changed from queryResponse.matches to reranked.data
const retrievedContext = reranked.data
	.map((result) => result.document?.text)
	.filter(Boolean)
	.join('\n\n');

// Use this in your streamText call:
return streamText({
	model: openai('gpt-4o'),
	system: systemPrompt,
	prompt: `Context: ${retrievedContext}\n\nUser Query: ${request.query}`,
});
```

---

## Understanding the Results

### Without Re-ranking (Vector Search Only)

```
Query: "React hooks with TypeScript"

Top 5 from Pinecone:
1. React hooks intro - 0.89
2. TypeScript basics - 0.87       ← Not specific enough
3. Using hooks - 0.86
4. TypeScript with React - 0.85   ← Not about hooks
5. React hooks patterns - 0.84
```

### With Re-ranking (Over-fetch + Re-rank)

```
Query: "React hooks with TypeScript"

Step 1 - Pinecone: Get top 10 similar docs

Step 2 - Cohere Re-rank:
1. React hooks with TypeScript guide - 0.95  ✅ Perfect
2. TypeScript types for hooks - 0.89         ✅ Highly relevant
3. useState with TypeScript - 0.84           ✅ Specific example
```

**Result:** Higher quality, more focused context for the LLM.

---

## When to Use Re-ranking

### ✅ Use Re-ranking When:

-   Queries are specific and nuanced
-   Your corpus has many similar documents
-   Precision matters more than speed
-   Production applications where quality is critical

### ❌ Skip Re-ranking When:

-   Queries are broad and simple
-   Small corpus (< 100 documents)
-   Latency is critical (re-ranking adds ~100-200ms)
-   Budget is very limited

---

## Cost & Performance Trade-offs

**Performance:**
| Approach | Pinecone | Re-ranking | Total |
| --------------------- | -------- | ---------- | ------ |
| Basic (topK=5) | ~50ms | - | ~50ms |
| Re-ranked (topK=10→3) | ~60ms | ~150ms | ~210ms |

**Cost (per 1,000 queries):**
| Service | Basic | With Re-ranking | Delta |
| -------------- | ----- | --------------- | ------ |
| Pinecone | $0.01 | $0.02 | +$0.01 |
| Cohere Re-rank | $0 | $2.00 | +$2.00 |
| **Total** | $0.01 | $2.02 | +$2.01 |

---

## Testing Your Implementation

Add logging to compare results:

```typescript
console.log(
	'Pinecone scores:',
	queryResponse.matches.map((m) => m.score)
);
console.log(
	'Re-ranked scores:',
	reranked.data.map((r) => r.score)
);
console.log('Context length:', retrievedContext.length);
```

You should see bigger gaps between relevant/irrelevant content in re-ranked scores.

---

## Complete Solution

<details>
<summary>Click to reveal the re-ranking implementation</summary>

```typescript
export async function ragAgent(request: AgentRequest): Promise<AgentResponse> {
	// Step 1: Generate embedding for the refined query
	const embeddingResponse = await openaiClient.embeddings.create({
		model: 'text-embedding-3-small',
		input: request.query,
	});

	const embedding = embeddingResponse.data[0].embedding;

	// Step 2: Query Pinecone for similar documents (over-fetch)
	const index = pineconeClient.Index(process.env.PINECONE_INDEX as string);

	const queryResponse = await index.query({
		vector: embedding,
		topK: 10, // Over-fetch more results
		includeMetadata: true,
	});

	// Step 2.5: Re-rank with Pinecone inference API
	const documents = queryResponse.matches
		.map((match) => match.metadata?.text ?? match.metadata?.content)
		.filter(Boolean);

	const reranked = await pineconeClient.inference.rerank(
		'bge-reranker-v2-m3',
		request.query,
		documents
	);

	// Step 3: Extract the text content from re-ranked results
	const retrievedContext = reranked.data
		.map((result) => result.document?.text)
		.filter(Boolean)
		.join('\n\n');

	// Step 4: Build the system prompt with context
	const systemPrompt = `You are a helpful assistant that answers questions based on the provided context.

Original User Request: "${request.originalQuery}"

Refined Query: "${request.query}"

Context from documentation:
${retrievedContext}

Use the context above to answer the user's question. If the context doesn't contain enough information, say so clearly.`;

	// Step 5: Stream the response
	return streamText({
		model: openai('gpt-4o'),
		system: systemPrompt,
		prompt: `Context: ${retrievedContext}\n\nUser Query: ${request.query}`,
	});
}
```

</details>

---

## What You Learned

✅ Why re-ranking improves RAG quality
✅ The over-fetch and re-rank strategy
✅ How to use Cohere's re-ranking via Pinecone
✅ Trade-offs between speed and accuracy
✅ When to use re-ranking vs basic retrieval
