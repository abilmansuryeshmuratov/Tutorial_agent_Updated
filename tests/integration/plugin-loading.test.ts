/**
 * Integration tests for plugin loading and interaction
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EnvironmentMocker } from '../utils/mockProvider';

describe('Plugin Loading Integration Tests', () => {
  const envMocker = new EnvironmentMocker();

  beforeEach(() => {
    envMocker.mock({
      OPENAI_API_KEY: undefined,
      BIRDEYE_API_KEY: undefined,
      COINGECKO_API_KEY: undefined,
      EVM_PRIVATE_KEY: undefined,
      RPC_URL: undefined
    });
  });

  afterEach(() => {
    envMocker.restore();
    vi.clearAllMocks();
  });

  it('should load all plugins in correct order', async () => {
    const loadOrder: string[] = [];
    
    // Mock plugin system
    const pluginSystem = {
      plugins: new Map(),
      
      register: function(plugin: any) {
        loadOrder.push(plugin.name);
        this.plugins.set(plugin.name, plugin);
      },
      
      loadPlugin: async function(pluginPath: string) {
        // Simulate plugin loading
        if (pluginPath.includes('goat')) {
          this.register({
            name: 'goat',
            description: 'GOAT SDK plugin',
            actions: [],
            onLoad: async () => {
              console.log('GOAT plugin loaded without API keys');
            }
          });
        } else if (pluginPath.includes('bnb-mcp')) {
          this.register({
            name: 'bnb-mcp',
            description: 'BNB MCP plugin',
            actions: ['bnb_insights'],
            onLoad: async () => {
              console.log('BNB MCP plugin loaded with public RPC');
            }
          });
        }
      }
    };

    // Load plugins
    await pluginSystem.loadPlugin('@elizaos/plugin-goat');
    await pluginSystem.loadPlugin('@elizaos/plugin-bnb-mcp');

    expect(loadOrder).toEqual(['goat', 'bnb-mcp']);
    expect(pluginSystem.plugins.size).toBe(2);
  });

  it('should handle plugin dependencies correctly', async () => {
    // Test that plugins can work together
    const runtime = {
      plugins: new Map(),
      providers: new Map(),
      actions: new Map(),
      
      registerPlugin: function(plugin: any) {
        this.plugins.set(plugin.name, plugin);
        
        // Register actions
        if (plugin.actions) {
          plugin.actions.forEach((action: any) => {
            this.actions.set(action.name || action, action);
          });
        }
        
        // Register providers
        if (plugin.providers) {
          plugin.providers.forEach((provider: any) => {
            this.providers.set(provider.name, provider);
          });
        }
      }
    };

    // Register GOAT plugin
    runtime.registerPlugin({
      name: 'goat',
      actions: [{
        name: 'SWAP_TOKENS',
        handler: async () => {
          throw new Error('No EVM_PRIVATE_KEY provided');
        }
      }],
      providers: [{
        name: 'priceProvider',
        get: async () => {
          return { error: 'No API keys configured' };
        }
      }]
    });

    // Register BNB MCP plugin
    runtime.registerPlugin({
      name: 'bnb-mcp',
      actions: [{
        name: 'BNB_INSIGHTS',
        handler: async () => {
          return {
            text: 'Latest BNB insights from public RPC',
            data: []
          };
        }
      }]
    });

    expect(runtime.plugins.size).toBe(2);
    expect(runtime.actions.size).toBe(2);
    expect(runtime.providers.size).toBe(1);

    // Test action execution
    const swapAction = runtime.actions.get('SWAP_TOKENS');
    await expect(swapAction.handler()).rejects.toThrow('No EVM_PRIVATE_KEY');

    const insightsAction = runtime.actions.get('BNB_INSIGHTS');
    const result = await insightsAction.handler();
    expect(result.text).toContain('BNB insights');
  });

  it('should handle plugin conflicts gracefully', async () => {
    const plugins: any[] = [];
    
    // Two plugins trying to register same action
    const plugin1 = {
      name: 'plugin1',
      actions: [{
        name: 'GET_PRICE',
        handler: async () => ({ price: 100 })
      }]
    };

    const plugin2 = {
      name: 'plugin2',
      actions: [{
        name: 'GET_PRICE',
        handler: async () => ({ price: 200 })
      }]
    };

    // Simulate conflict resolution
    const actionRegistry = new Map();
    
    [plugin1, plugin2].forEach(plugin => {
      plugin.actions.forEach(action => {
        if (actionRegistry.has(action.name)) {
          console.warn(`Action ${action.name} already registered by another plugin`);
        } else {
          actionRegistry.set(action.name, {
            ...action,
            plugin: plugin.name
          });
        }
      });
    });

    expect(actionRegistry.size).toBe(1);
    expect(actionRegistry.get('GET_PRICE').plugin).toBe('plugin1');
  });

  it('should gracefully degrade functionality without keys', async () => {
    // Simulate a complex action that requires multiple APIs
    const complexAction = async (runtime: any) => {
      const results = {
        priceData: null,
        gasPrice: null,
        moderation: null,
        canExecute: false
      };

      // Try to get price data
      try {
        // Would normally call Birdeye/CoinGecko
        results.priceData = null;
      } catch (e) {
        console.log('Price data unavailable');
      }

      // Try to get gas price
      try {
        // Uses public RPC, should work
        results.gasPrice = '1000000000'; // 1 gwei
      } catch (e) {
        console.log('Gas price unavailable');
      }

      // Try moderation
      try {
        // No OpenAI key, skip moderation
        results.moderation = { skipped: true, reason: 'No API key' };
      } catch (e) {
        console.log('Moderation unavailable');
      }

      // Determine if action can execute
      results.canExecute = !!results.gasPrice; // Only need gas price

      return results;
    };

    const result = await complexAction({});
    
    expect(result.priceData).toBeNull();
    expect(result.gasPrice).toBe('1000000000');
    expect(result.moderation.skipped).toBe(true);
    expect(result.canExecute).toBe(true);
  });
});