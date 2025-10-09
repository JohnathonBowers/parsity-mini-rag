import { AgentRequest, AgentResponse } from './types';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function linkedInAgent(
	request: AgentRequest
): Promise<AgentResponse> {
	const systemPrompt = `You are a professional LinkedIn copywriter who creates high-engagement posts.

Original user request: "${request.originalQuery}"
Refined query: "${request.query}"

Use the refined query to understand the user's intent and create an engaging LinkedIn post.`;

	return streamText({
		model: openai(process.env.OPENAI_FINETUNED_MODEL!),
		system: systemPrompt,
		messages: request.messages,
	});
}
