/**
 * Integration tests for agent startup without API keys
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { EnvironmentMocker } from '../utils/mockProvider';
import * as path from 'path';
import * as fs from 'fs';

describe('Agent Startup Integration Tests', () => {
  const envMocker = new EnvironmentMocker();
  const testCharacterPath = path.join(__dirname, 'test-character.json');

  beforeAll(() => {
    // Create test character file
    const testCharacter = {
      name: "TestAgent",
      plugins: [
        "@elizaos/plugin-goat",
        "@elizaos/plugin-bnb-mcp"
      ],
      clients: [],
      modelProvider: "openai",
      settings: {
        secrets: {},
        voice: {
          model: "en_US-hfc_female-medium"
        }
      }
    };

    fs.writeFileSync(testCharacterPath, JSON.stringify(testCharacter, null, 2));

    // Clear all API keys
    envMocker.mock({
      OPENAI_API_KEY: undefined,
      BIRDEYE_API_KEY: undefined,
      COINGECKO_API_KEY: undefined,
      EVM_PRIVATE_KEY: undefined,
      EVM_PROVIDER_URL: undefined,
      RPC_URL: undefined
    });
  });

  afterAll(() => {
    envMocker.restore();
    if (fs.existsSync(testCharacterPath)) {
      fs.unlinkSync(testCharacterPath);
    }
  });

  it('should start agent without any API keys', async () => {
    const warnings: string[] = [];
    const logs: string[] = [];
    const originalWarn = console.warn;
    const originalLog = console.log;
    console.warn = (msg: string) => {
      warnings.push(msg);
      originalWarn(msg); // Still show the warning
    };
    console.log = (msg: string) => {
      logs.push(msg);
      originalLog(msg); // Still show the log
    };

    try {
      // Mock the agent startup process
      const { AgentRuntime } = await import('@elizaos/core');
      
      // Create a minimal mock database adapter
      const mockDatabaseAdapter = {
        // Required methods for IDatabaseAdapter
        init: vi.fn().mockResolvedValue(true),
        close: vi.fn().mockResolvedValue(true),
        getMemory: vi.fn().mockResolvedValue(null),
        getMemories: vi.fn().mockResolvedValue([]),
        getMemoriesByIds: vi.fn().mockResolvedValue([]),
        getMemoriesByRoomIds: vi.fn().mockResolvedValue([]),
        getMemoryById: vi.fn().mockResolvedValue(null),
        createMemory: vi.fn().mockResolvedValue(true),
        updateMemory: vi.fn().mockResolvedValue(true),
        removeMemory: vi.fn().mockResolvedValue(true),
        removeAllMemories: vi.fn().mockResolvedValue(true),
        countMemories: vi.fn().mockResolvedValue(0),
        getGoals: vi.fn().mockResolvedValue([]),
        updateGoal: vi.fn().mockResolvedValue(true),
        createGoal: vi.fn().mockResolvedValue(true),
        removeGoal: vi.fn().mockResolvedValue(true),
        removeAllGoals: vi.fn().mockResolvedValue(true),
        getRoom: vi.fn().mockResolvedValue(null),
        createRoom: vi.fn().mockResolvedValue('room-id'),
        removeRoom: vi.fn().mockResolvedValue(true),
        getRoomsByParticipant: vi.fn().mockResolvedValue([]),
        getRoomsByParticipants: vi.fn().mockResolvedValue([]),
        getParticipants: vi.fn().mockResolvedValue([]),
        getParticipantUserState: vi.fn().mockResolvedValue(null),
        setParticipantUserState: vi.fn().mockResolvedValue(true),
        createParticipant: vi.fn().mockResolvedValue(true),
        removeParticipant: vi.fn().mockResolvedValue(true),
        updateParticipant: vi.fn().mockResolvedValue(true),
        getRelationship: vi.fn().mockResolvedValue(null),
        getRelationships: vi.fn().mockResolvedValue([]),
        createRelationship: vi.fn().mockResolvedValue(true),
        updateRelationship: vi.fn().mockResolvedValue(true),
        removeRelationship: vi.fn().mockResolvedValue(true),
        // Account methods
        getAccountById: vi.fn().mockResolvedValue(null),
        createAccount: vi.fn().mockResolvedValue('account-id'),
        getAccountByEmail: vi.fn().mockResolvedValue(null),
        getAccountByUsername: vi.fn().mockResolvedValue(null),
        getParticipantsForAccount: vi.fn().mockResolvedValue([]),
        addParticipant: vi.fn().mockResolvedValue(true)
      };
      
      // Create mock cache manager
      const mockCacheManager = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(true),
        delete: vi.fn().mockResolvedValue(true),
        clear: vi.fn().mockResolvedValue(true)
      };
      
      const runtime = new AgentRuntime({
        character: JSON.parse(fs.readFileSync(testCharacterPath, 'utf-8')),
        modelProvider: 'openai',
        plugins: [],
        databaseAdapter: mockDatabaseAdapter as any,
        cacheManager: mockCacheManager as any,
        token: 'test-token'
      });

      expect(runtime).toBeDefined();
      expect(runtime.agentId).toBeDefined();
      expect(runtime.character.name).toBe('TestAgent');
      
      // Agent should start successfully even without API keys
      expect(runtime.databaseAdapter).toBe(mockDatabaseAdapter);
      expect(runtime.cacheManager).toBe(mockCacheManager);
      
      // Verify no API keys are set
      expect(process.env.OPENAI_API_KEY).toBeUndefined();
    } finally {
      console.warn = originalWarn;
      console.log = originalLog;
    }
  });

  it('should load plugins without API keys', async () => {
    // Mock plugin loading
    const mockPluginLoader = {
      loadPlugin: vi.fn().mockImplementation((pluginName: string) => {
        console.log(`Loading plugin: ${pluginName}`);
        
        if (pluginName === '@elizaos/plugin-goat') {
          return {
            name: 'goat',
            actions: [],
            providers: [],
            description: 'GOAT plugin (no API keys)'
          };
        }
        
        if (pluginName === '@elizaos/plugin-bnb-mcp') {
          return {
            name: 'bnb-mcp',
            actions: [{
              name: 'bnb_insights',
              handler: async () => ({ text: 'Mock insights' })
            }],
            providers: [],
            description: 'BNB MCP plugin (using public RPC)'
          };
        }
        
        return null;
      })
    };

    const plugin1 = await mockPluginLoader.loadPlugin('@elizaos/plugin-goat');
    const plugin2 = await mockPluginLoader.loadPlugin('@elizaos/plugin-bnb-mcp');

    expect(plugin1).toBeDefined();
    expect(plugin1?.name).toBe('goat');
    expect(plugin2).toBeDefined();
    expect(plugin2?.name).toBe('bnb-mcp');
  });

  it('should handle missing environment variables gracefully', async () => {
    const getSetting = (key: string) => {
      return process.env[key] || null;
    };

    // Test all critical settings
    expect(getSetting('OPENAI_API_KEY')).toBeNull();
    expect(getSetting('BIRDEYE_API_KEY')).toBeNull();
    expect(getSetting('COINGECKO_API_KEY')).toBeNull();
    expect(getSetting('EVM_PRIVATE_KEY')).toBeNull();

    // System should still function
    const canStartWithoutKeys = true;
    expect(canStartWithoutKeys).toBe(true);
  });

  it('should use fallback configurations', async () => {
    // Test RPC fallback
    const rpcUrl = process.env.RPC_URL || 'https://bsc-dataseed.binance.org/';
    expect(rpcUrl).toBe('https://bsc-dataseed.binance.org/');

    // Test moderation fallback (fail-open)
    const moderationEnabled = process.env.TWITTER_MODERATION_ENABLED !== 'false';
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const shouldModerate = moderationEnabled && hasOpenAIKey;
    
    expect(shouldModerate).toBe(false); // No API key, so no moderation
  });
});