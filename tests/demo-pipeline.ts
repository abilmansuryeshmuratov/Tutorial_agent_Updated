/**
 * Demo: Full Pipeline Without API Keys
 * This demonstrates how the entire system works without any API keys
 */

import { MockOpenAIClient, mockGenerateText } from './unit/core/mocks/openai-generation.mock';
import { MockViemClient } from './unit/plugins/bnb-mcp/mocks/rpc.mock';

async function demonstratePipeline() {
  console.log('===========================================');
  console.log('Eliza Pipeline Demo - No API Keys Required');
  console.log('===========================================\n');

  // Scenario 1: User asks for BNB insights
  console.log('📥 SCENARIO 1: User requests BNB insights');
  console.log('User: "Show me the latest BNB network insights"\n');

  // Step 1: Fetch blockchain data (works without keys)
  console.log('🔍 Step 1: Fetching blockchain data...');
  const client = new MockViemClient();
  const gasPrice = await client.getGasPrice();
  const blockNumber = await client.getBlockNumber();
  console.log(`   ✓ Gas Price: ${Number(gasPrice) / 1e9} gwei`);
  console.log(`   ✓ Block Number: ${blockNumber}`);
  console.log(`   ✓ Network: BSC (using public RPC)\n`);

  // Step 2: Generate content (no OpenAI key)
  console.log('✍️  Step 2: Generating content...');
  const mockRuntime = { getSetting: () => null };
  const context = `Create insight about BNB network: gas ${Number(gasPrice) / 1e9} gwei, block ${blockNumber}`;
  const content1 = await mockGenerateText(mockRuntime, context);
  console.log(`   Generated: "${content1}"\n`);

  // Step 3: Moderation check (skipped - no key)
  console.log('🛡️  Step 3: Content moderation...');
  console.log('   ⚠️  Skipped - No OpenAI API key');
  console.log('   ✓ Content allowed (fail-open policy)\n');

  // Step 4: Output
  console.log('📤 Final Output to User:');
  console.log(`   "${content1}"`);
  console.log('   ℹ️  Note: Generated with fallback content\n');

  console.log('-------------------------------------------\n');

  // Scenario 2: With OpenAI key
  console.log('📥 SCENARIO 2: Same request WITH OpenAI key');
  process.env.OPENAI_API_KEY = 'demo_key';
  
  console.log('✍️  Step 1: Generating content with AI...');
  const mockRuntimeWithKey = { getSetting: (key: string) => process.env[key] };
  const content2 = await mockGenerateText(mockRuntimeWithKey, context);
  console.log(`   Generated: "${content2}"\n`);

  console.log('🛡️  Step 2: Content moderation...');
  const openai = new MockOpenAIClient('demo_key');
  const modResult = await openai.moderations.create({ input: content2 });
  console.log(`   ✓ Content checked`);
  console.log(`   ✓ Flagged: ${modResult.results[0].flagged}`);
  console.log(`   ✓ Safe to post\n`);

  console.log('📤 Final Output to User:');
  console.log(`   "${content2}"`);
  console.log('   ✅ Full AI-generated content with moderation\n');

  console.log('-------------------------------------------\n');

  // Scenario 3: Price query without keys
  console.log('📥 SCENARIO 3: Price query without API keys');
  console.log('User: "What is the current price of BNB?"\n');

  console.log('💰 Step 1: Checking price data sources...');
  console.log('   ❌ Birdeye API: No API key');
  console.log('   ❌ CoinGecko API: No API key');
  console.log('   ❌ Cannot fetch price data\n');

  console.log('📤 Response to User:');
  console.log('   "I understand you want to check the price, but No API keys configured for price data."');
  console.log('   "I can still help you understand how this would work!"\n');

  console.log('-------------------------------------------\n');

  // Summary
  console.log('📊 PIPELINE SUMMARY:');
  console.log('✅ Blockchain data: Available (public RPC)');
  console.log('⚠️  AI Generation: Fallback mode (no OpenAI key)');
  console.log('⚠️  Content Moderation: Disabled (fail-open)');
  console.log('❌ Price Data: Unavailable (no API keys)');
  console.log('❌ Trading: Unavailable (no wallet key)');
  console.log('\n✨ The system gracefully handles missing API keys!');

  // Cleanup
  delete process.env.OPENAI_API_KEY;
}

// Run the demo
if (require.main === module) {
  demonstratePipeline().catch(console.error);
}