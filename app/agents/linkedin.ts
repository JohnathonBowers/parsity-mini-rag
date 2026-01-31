import { AgentRequest, AgentResponse } from './types';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function linkedInAgent(
	request: AgentRequest
): Promise<AgentResponse> {
	return streamText({
		model: openai(process.env.OPENAI_FINETUNED_MODEL!),
		temperature: 0.8,
		messages: [
			{
				role: 'system',
				content: `You are a LinkedIn post editor. Polish the user's LinkedIn post to make it more engaging, professional, and impactful while maintaining their authentic voice and message.`,
			},
			...request.messages,
		],
	});
}