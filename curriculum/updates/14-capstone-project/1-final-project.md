# Capstone Project: Build Your Custom RAG System

Congratulations on making it this far! You've learned all the core concepts needed to build a production-ready RAG system with intelligent agents. Now it's time to put it all together and showcase your work.

---

## Project Overview

For your capstone project, you'll customize and extend the RAG system you've built throughout this course. You have two main options for your data source, and you'll customize the agent architecture to fit your use case.

**Deliverables:**
1. ✅ A fully functional, deployed RAG application
2. ✅ Custom data uploaded to Pinecone
3. ✅ Modified or extended agent system
4. ✅ 5-minute Loom video presentation
5. ✅ Clean, documented code repository

---

## Part 1: Choose Your Data Source (30 minutes)

You have two options:

### Option A: Use Brian's LinkedIn Posts

The easiest option is to use the provided LinkedIn data that's already formatted and ready to go.

**Location:** `app/scripts/data/brian_posts.csv`

**What's included:**
- 50+ professional LinkedIn posts
- Metadata: impressions, reactions, comments, shares
- Topics: career advice, tech industry insights, learning strategies
- Pre-formatted CSV ready for upload

**To upload:**

```bash
# Create a script to parse and upload the CSV
yarn upload-linkedin-data
```

You'll need to create this script based on the patterns you learned in Module 5. The CSV format is:
```csv
urn,text,type,firstName,lastName,numImpressions,numViews,numReactions,numComments,numShares,...
```

**Why choose this option?**
- ✅ Data is already clean and ready
- ✅ Consistent format and quality
- ✅ Known content domain (professional advice)
- ✅ Focus more time on agent customization

### Option B: Scrape Your Own Data

If you want a fully custom domain, scrape your own data sources.

**Steps:**

1. **Choose your domain:**
   - Your own blog/website
   - Public documentation you find valuable
   - Reddit posts from specific subreddits
   - GitHub repository READMEs
   - Product reviews or testimonials
   - Any public web content

2. **Create your scraping script:**

```typescript
// app/scripts/scrapeCustomData.ts
import { DataProcessor } from '../libs/dataProcessor';
import { openaiClient } from '../libs/openai/openai';
import { pineconeClient } from '../libs/pinecone';

const urls = [
  'https://your-domain.com/page-1',
  'https://your-domain.com/page-2',
  // Add 10-20 URLs
];

async function scrapeAndUpload() {
  const processor = new DataProcessor();
  const chunks = await processor.processUrls(urls);

  // Generate embeddings and upload
  // (Use the pattern from scrapeAndVectorizeContent.ts)
}

scrapeAndUpload();
```

3. **Run your script:**
```bash
npx tsx app/scripts/scrapeCustomData.ts
```

**Why choose this option?**
- ✅ Fully personalized domain
- ✅ Practice end-to-end data pipeline
- ✅ More impressive for portfolio
- ⚠️ Requires more time and debugging

**Requirements for Option B:**
- Minimum 10 URLs or 5,000 words of content
- Content must be public and ethical to scrape
- Must be properly chunked and vectorized

---

## Part 2: Customize Your Agent System (1-2 hours)

Now that you have data in Pinecone, customize the agent architecture to fit your use case.

### Current Agent Architecture

Your system currently has:
- **Selector Agent**: Routes queries to the right agent
- **LinkedIn Agent**: Handles career/professional questions (fine-tuned model)
- **RAG Agent**: Retrieves context from Pinecone and generates answers

### Your Task: Modify the Agent System

You must make at least **one significant change** to the agent architecture:

#### Option 1: Add a New Agent

Create a new specialized agent for a specific task:

```typescript
// app/agents/analytics.ts
export async function analyticsAgent(request: AgentRequest): Promise<AgentResponse> {
  // Agent that analyzes data patterns
  // Example: "What were the most engaging posts?"

  const systemPrompt = `You are a data analyst specializing in social media metrics...`;

  return streamText({
    model: openai('gpt-4o-mini'),
    system: systemPrompt,
    prompt: request.query,
  });
}
```

**Ideas for new agents:**
- Summary agent (creates bullet-point summaries)
- Code agent (for technical/programming queries)
- Comparison agent (compares multiple options)
- Tutorial agent (creates step-by-step guides)

#### Option 2: Remove an Agent

Simplify the system by removing an agent you don't need:

1. Remove agent implementation from `app/agents/`
2. Update the agent types in `app/agents/types.ts`
3. Update the selector agent in `app/api/select-agent/route.ts`
4. Remove the agent from the selector's decision logic

#### Option 3: Chain Agents Together

Create a multi-step workflow where agents collaborate:

```typescript
// Example: Query refinement → RAG retrieval → Summary generation

// Step 1: Refine the query
const refinedQuery = await queryRefinementAgent(request);

// Step 2: Get context from RAG
const context = await ragAgent({ ...request, query: refinedQuery });

// Step 3: Summarize the response
const summary = await summaryAgent({ context, query: refinedQuery });
```

#### Option 4: Modify the Selector Logic

Improve how queries are routed:

- Add more sophisticated routing rules
- Use structured outputs to add confidence scores
- Implement fallback logic when confidence is low
- Add query classification categories

**Document your changes!** In your README, explain:
- What you changed and why
- How it improves the system
- Examples of queries that benefit from your changes

---

## Part 3: Testing & Quality Assurance (30 minutes)

Before deploying, thoroughly test your system:

### 1. Test Query Routing

Create a test file with diverse queries:

```typescript
// app/tests/test-queries.ts
const testQueries = [
  "What's the best career advice you have?",
  "How do I learn JavaScript?",
  "What were the most popular posts?",
  "Tell me about React hooks",
  // Add 10-15 varied queries
];

// Test each query and verify:
// - Correct agent is selected
// - Response is relevant
// - Sources are cited (for RAG)
```

### 2. Run Agent Tests

```bash
yarn test:selector
```

Make sure your selector agent routes queries correctly.

### 3. Check Edge Cases

Test with:
- Very short queries ("help")
- Very long queries (200+ words)
- Queries outside your domain
- Queries with typos or bad grammar

### 4. Verify Data Quality

Check your Pinecone index:
```typescript
const stats = await index.describeIndexStats();
console.log('Total vectors:', stats.totalRecordCount);
// Should match your expected chunk count
```

---

## Part 4: Deploy Your Application (30 minutes)

Deploy your RAG system so others can use it.

### Deployment with Vercel

1. **Prepare for deployment:**

```bash
# Make sure all environment variables are set
# Create .env.local with:
OPENAI_API_KEY=...
PINECONE_API_KEY=...
PINECONE_INDEX=...
HELICONE_API_KEY=...
```

2. **Deploy to Vercel:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# Settings → Environment Variables
```

3. **Test deployment:**
- Visit your Vercel URL
- Test multiple queries
- Check Helicone dashboard for logs
- Verify everything works in production

### Alternative: Deploy to Railway/Render

If you prefer another platform:
- [Railway](https://railway.app/) - Simple deployment for full-stack apps
- [Render](https://render.com/) - Free tier available
- [Fly.io](https://fly.io/) - Global deployment

---

## Part 5: Create Your Loom Presentation (5 minutes)

Record a **5-minute maximum** Loom video showcasing your project.

### What to Include:

**1. Introduction (30 seconds)**
- Your name
- Brief overview of your project

**2. Demo (2 minutes)**
- Show the live deployed application
- Run 3-5 example queries
- Demonstrate agent routing
- Show different types of responses

**3. Architecture Overview (1.5 minutes)**
- Explain your data source choice
- Walk through your agent modifications
- Show a quick code snippet of your key customization
- Explain why you made these choices

**4. Challenges & Solutions (1 minute)**
- What was the hardest part?
- How did you solve it?
- What would you improve next?

**Tips for a great presentation:**
- ✅ Practice beforehand to stay under 5 minutes
- ✅ Show, don't just tell (demonstrate features)
- ✅ Be specific about your contributions
- ✅ Speak clearly and with energy
- ❌ Don't read from a script
- ❌ Don't spend time on setup/prerequisites

**How to record:**
1. Go to [loom.com](https://www.loom.com/)
2. Sign up for free account
3. Use the desktop app or browser extension
4. Record your screen + camera (optional)
5. Get the shareable link

---

## Part 6: Prepare Your Code Repository (30 minutes)

Clean up your code and create comprehensive documentation.

### Required Files:

#### 1. README.md

Create a professional README with:

```markdown
# [Your Project Name]

[Brief description of what your RAG system does]

## Domain & Data Source

[Explain your data source choice and why]

## Agent Architecture

[Diagram or list of agents and their responsibilities]

### Modifications from Base System

[Explain what you changed/added/removed and why]

## Features

- [Feature 1]
- [Feature 2]
- [Feature 3]

## Tech Stack

- Next.js 14
- OpenAI API (GPT-4o)
- Pinecone Vector Database
- Vercel AI SDK
- Helicone (Observability)

## Setup & Installation

\`\`\`bash
# Clone the repo
git clone [your-repo-url]

# Install dependencies
yarn install

# Set up environment variables
cp .env.example .env.local
# Add your API keys

# Run development server
yarn dev
\`\`\`

## Example Queries

Try these queries to see the system in action:

1. "[Example query 1]"
2. "[Example query 2]"
3. "[Example query 3]"
4. "[Example query 4]"
5. "[Example query 5]"

## Challenges & Solutions

### Challenge 1: [Describe challenge]
**Solution:** [How you solved it]

### Challenge 2: [Describe challenge]
**Solution:** [How you solved it]

## Future Improvements

- [Improvement idea 1]
- [Improvement idea 2]
- [Improvement idea 3]

## Deployment

Live URL: [your-vercel-url]

## Contact

[Your name] - [Your LinkedIn/GitHub]
```

#### 2. .env.example

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...

# Pinecone Configuration
PINECONE_API_KEY=...
PINECONE_INDEX=your-index-name

# Helicone (Observability)
HELICONE_API_KEY=sk-helicone-...

# Optional: Fine-tuned model
OPENAI_LINKEDIN_MODEL=ft:gpt-4o-mini-2024-07-18:...
```

#### 3. Clean Up Your Code

- Remove console.logs used for debugging
- Remove commented-out code
- Add helpful comments to complex logic
- Ensure consistent formatting
- Remove unused imports

---

## Submission Checklist

Before submitting, verify you have:

- [ ] ✅ Deployed application with public URL
- [ ] ✅ Data uploaded to Pinecone (Option A or B)
- [ ] ✅ At least one agent system modification
- [ ] ✅ 5-minute Loom video presentation
- [ ] ✅ Clean GitHub repository with README
- [ ] ✅ Environment variables documented
- [ ] ✅ 5+ example queries tested
- [ ] ✅ Code is well-commented
- [ ] ✅ All tests passing

---

## Submission Instructions

Submit the following:

1. **Deployed URL:** [Your Vercel/Railway/Render URL]
2. **GitHub Repository:** [Your repo URL]
3. **Loom Video:** [Your Loom presentation link]
4. **Brief Summary (3-5 sentences):**
   - What data source you chose
   - What agent modifications you made
   - One interesting challenge you solved

---

## Grading Rubric

Your project will be evaluated on:

### Technical Implementation (40%)
- ✅ Data successfully uploaded to Pinecone
- ✅ Agent system functions correctly
- ✅ Proper error handling
- ✅ Code quality and organization

### Customization & Creativity (30%)
- ✅ Meaningful modifications to agent system
- ✅ Well-thought-out design decisions
- ✅ Unique features or improvements

### Deployment & Documentation (20%)
- ✅ Successfully deployed and accessible
- ✅ Clear, comprehensive README
- ✅ Well-documented code

### Presentation (10%)
- ✅ Clear explanation of project
- ✅ Effective demonstration
- ✅ Professional delivery
- ✅ Under 5 minutes

---

## Example Project Ideas

Need inspiration? Here are some ideas:

### 1. **Career Coach RAG** (LinkedIn Data)
- Use Brian's LinkedIn posts
- Add "motivation agent" for inspirational responses
- Add "advice finder" that ranks posts by engagement

### 2. **Documentation Assistant** (Custom Data)
- Scrape React/Next.js docs
- Add "code example agent" that generates sample code
- Implement "tutorial generator" that creates step-by-step guides

### 3. **Product Knowledge Base** (Custom Data)
- Upload product documentation
- Add "comparison agent" for feature comparisons
- Implement "troubleshooting agent" for common issues

### 4. **Learning Companion** (Custom Data)
- Scrape course materials or textbooks
- Add "quiz generator agent"
- Implement "explanation simplifier" for complex topics

---

## Getting Help

If you get stuck:

1. **Review the curriculum modules** - Go back to specific sections
2. **Check existing implementations** - Look at how other agents work
3. **Test incrementally** - Don't try to do everything at once
4. **Use Helicone** - Check your API calls and errors
5. **Debug systematically** - Verify each component separately

---

## What's Next?

After completing your capstone:

1. **Share your work** - Post on LinkedIn/Twitter
2. **Add to portfolio** - Showcase on your website
3. **Keep improving** - Add new features and agents
4. **Explore advanced topics:**
   - Multi-modal RAG (images + text)
   - Agentic workflows with tool calling
   - Custom fine-tuning your own models
   - Advanced caching and optimization

---

## Congratulations! 🎉

You've built a production-ready RAG system with intelligent agents. This is a significant achievement and puts you ahead of most developers in the AI space.

**What you've learned:**
- ✅ Vector embeddings and semantic search
- ✅ Pinecone vector database integration
- ✅ OpenAI API and fine-tuning
- ✅ Multi-agent architectures
- ✅ Streaming responses with Vercel AI SDK
- ✅ Re-ranking for better retrieval
- ✅ Observability with Helicone
- ✅ Production deployment

Take pride in what you've built, and keep pushing the boundaries of what's possible with AI!

---

**Good luck with your capstone project! We can't wait to see what you build.** 🚀
