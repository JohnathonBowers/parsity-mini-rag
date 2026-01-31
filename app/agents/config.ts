import { AgentType, AgentConfig } from './types';

export const agentConfigs: Record<AgentType, AgentConfig> = {
	linkedin: {
		name: 'LinkedIn Agent',
		description:
			'For polishing a written post in a certain voice and tone for LinkedIn. The user will provide a topic or starter content and you will polish the content.',
	},
	rag: {
		name: 'RAG Agent',
		description:
			'For generating a LinkedIn post based on a user query.',
	},
};
