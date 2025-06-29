/**
 * OpenAI Text Generation Mock
 * Simulates OpenAI API responses for content generation
 */

export interface GenerationRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

export interface GenerationResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Content templates for different scenarios
const contentTemplates = {
  bnbInsight: [
    "🚨 Large BNB transaction detected! {amount} BNB moved from {from} to {to}. This significant transfer could indicate whale activity in the market.",
    "📊 BNB Network Update: Gas prices are currently at {gasPrice} gwei. Network activity shows {trend} trend with {blockCount} blocks processed in the last hour.",
    "🔥 New smart contract deployed on BSC! Address: {address}. This could be an upcoming DeFi project or NFT collection. Always DYOR before interacting.",
    "💰 Token Transfer Alert: {amount} {token} tokens moved between wallets. Volume spike detected on BSC network."
  ],
  
  priceUpdate: [
    "📈 {token} is currently trading at ${price}, {change}% in the last 24h. Market sentiment appears {sentiment}.",
    "💹 Price Alert: {token} has {movement} to ${price}. Trading volume: ${volume}. Key support at ${support}.",
    "🔔 Market Update: {token} price action shows {pattern} pattern. Current price: ${price} | 24h change: {change}%"
  ],
  
  generalResponse: [
    "I've analyzed the blockchain data you requested. {analysis}",
    "Based on the current market conditions, {observation}. Always remember to do your own research.",
    "Here's what I found: {findings}. The blockchain data suggests {conclusion}."
  ],
  
  errorResponse: [
    "I'm currently unable to fetch live data, but I can provide general insights about {topic}.",
    "Some features require API configuration. However, I can help you understand {subject}.",
    "While I can't access real-time prices without API keys, I can explain {concept} for you."
  ]
};

// Generate contextual content based on input
export function generateMockContent(context: any): string {
  const { type, data } = context;
  
  switch (type) {
    case 'bnb_insight':
      const template = contentTemplates.bnbInsight[Math.floor(Math.random() * contentTemplates.bnbInsight.length)];
      return template
        .replace('{amount}', data.amount || '100')
        .replace('{from}', data.from || '0x123...abc')
        .replace('{to}', data.to || '0x456...def')
        .replace('{gasPrice}', data.gasPrice || '1')
        .replace('{trend}', data.trend || 'increasing')
        .replace('{blockCount}', data.blockCount || '240')
        .replace('{address}', data.address || '0x789...ghi')
        .replace('{token}', data.token || 'USDT');
    
    case 'price_update':
      const priceTemplate = contentTemplates.priceUpdate[Math.floor(Math.random() * contentTemplates.priceUpdate.length)];
      return priceTemplate
        .replace('{token}', data.token || 'BNB')
        .replace('{price}', data.price || '245.50')
        .replace('{change}', data.change || '+2.5')
        .replace('{sentiment}', data.sentiment || 'bullish')
        .replace('{movement}', data.movement || 'surged')
        .replace('{volume}', data.volume || '1.2M')
        .replace('{support}', data.support || '240')
        .replace('{pattern}', data.pattern || 'ascending triangle');
    
    case 'general':
      const generalTemplate = contentTemplates.generalResponse[Math.floor(Math.random() * contentTemplates.generalResponse.length)];
      return generalTemplate
        .replace('{analysis}', data.analysis || 'The network is operating normally')
        .replace('{observation}', data.observation || 'market volatility is within normal ranges')
        .replace('{findings}', data.findings || 'Transaction volume is steady')
        .replace('{conclusion}', data.conclusion || 'healthy network activity');
    
    case 'error':
      const errorTemplate = contentTemplates.errorResponse[Math.floor(Math.random() * contentTemplates.errorResponse.length)];
      return errorTemplate
        .replace('{topic}', data.topic || 'blockchain technology')
        .replace('{subject}', data.subject || 'DeFi protocols')
        .replace('{concept}', data.concept || 'smart contract interactions');
    
    default:
      return "I'm here to help with blockchain insights and analysis. What would you like to know?";
  }
}

// Mock OpenAI completion API
export function createOpenAICompletionMock(apiKey?: string) {
  return {
    async create(request: GenerationRequest): Promise<GenerationResponse> {
      // Simulate API key validation
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      if (apiKey === 'invalid_key') {
        throw new Error('Invalid API key provided');
      }
      
      // Extract context from the messages
      const lastMessage = request.messages[request.messages.length - 1];
      const content = lastMessage.content.toLowerCase();
      
      // Determine response type based on content
      let responseType = 'general';
      let responseData: any = {};
      
      if (content.includes('bnb') || content.includes('insight') || content.includes('transaction')) {
        responseType = 'bnb_insight';
        responseData = {
          amount: '500',
          gasPrice: '1',
          trend: 'stable',
          blockCount: '300'
        };
      } else if (content.includes('price') || content.includes('trading')) {
        responseType = 'price_update';
        responseData = {
          token: 'BNB',
          price: '245.50',
          change: '+2.5',
          volume: '2.3M'
        };
      } else if (content.includes('error') || content.includes('fail')) {
        responseType = 'error';
        responseData = {
          topic: 'the requested data'
        };
      }
      
      // Generate appropriate content
      const generatedContent = generateMockContent({
        type: responseType,
        data: responseData
      });
      
      // Simulate response delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model || 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: generatedContent
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 30,
          total_tokens: 80
        }
      };
    }
  };
}

// Mock the entire OpenAI client
export class MockOpenAIClient {
  public chat: {
    completions: ReturnType<typeof createOpenAICompletionMock>;
  };
  
  public moderations: any;
  
  constructor(private apiKey?: string) {
    this.chat = {
      completions: createOpenAICompletionMock(apiKey)
    };
    
    // Include moderation mock from the other file
    this.moderations = {
      create: async ({ input }: { input: string }) => {
        if (!this.apiKey) {
          throw new Error('OpenAI API key not configured');
        }
        
        // Simple moderation logic
        const lowerInput = input.toLowerCase();
        const shouldFlag = lowerInput.includes('hate') || lowerInput.includes('violence');
        
        return {
          id: `mod-${Date.now()}`,
          model: 'text-moderation-007',
          results: [{
            categories: {
              'hate': shouldFlag,
              'violence': shouldFlag,
              'harassment': false,
              'self-harm': false,
              'sexual': false,
              'hate/threatening': false,
              'harassment/threatening': false,
              'self-harm/intent': false,
              'self-harm/instructions': false,
              'sexual/minors': false,
              'violence/graphic': false
            },
            category_scores: {
              'hate': shouldFlag ? 0.8 : 0.01,
              'violence': shouldFlag ? 0.8 : 0.01,
              'harassment': 0.01,
              'self-harm': 0.001,
              'sexual': 0.001,
              'hate/threatening': 0.001,
              'harassment/threatening': 0.001,
              'self-harm/intent': 0.0001,
              'self-harm/instructions': 0.0001,
              'sexual/minors': 0.0001,
              'violence/graphic': 0.001
            },
            flagged: shouldFlag
          }]
        };
      }
    };
  }
}

// Helper to simulate Eliza's generateText function
export async function mockGenerateText(
  runtime: any,
  context: string,
  modelClass?: string
): Promise<string> {
  // If no OpenAI key, return a fallback response
  if (!runtime.getSetting?.('OPENAI_API_KEY')) {
    // Parse context to understand what's needed
    if (context.includes('tweet') || context.includes('Twitter')) {
      return "🔍 Blockchain insight: Network activity detected. [Generated without API key]";
    }
    return "I can help with blockchain analysis. [Generated without API key]";
  }
  
  // Otherwise use the mock OpenAI client
  const client = new MockOpenAIClient(runtime.getSetting('OPENAI_API_KEY'));
  
  const response = await client.chat.completions.create({
    model: modelClass === 'large' ? 'gpt-4' : 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful blockchain analyst.' },
      { role: 'user', content: context }
    ]
  });
  
  return response.choices[0].message.content;
}