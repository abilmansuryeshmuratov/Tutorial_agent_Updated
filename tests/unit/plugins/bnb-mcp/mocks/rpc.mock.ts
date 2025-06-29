/**
 * BSC RPC Mock Data
 */

export const mockRPCResponses = {
  // eth_blockNumber
  blockNumber: '0x1c9c364', // 30000036 in decimal

  // eth_gasPrice
  gasPrice: '0x3b9aca00', // 1 gwei

  // eth_getBalance
  balance: '0x8ac7230489e80000', // 10 ETH in wei

  // Large transaction
  largeTransaction: {
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    nonce: '0x15',
    blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    blockNumber: '0x1c9c364',
    transactionIndex: '0x1',
    from: '0x742d35Cc6634C0532925a3b844Bc9e7595f7F123',
    to: '0x8A3b1c4D5e6F7890AbCdEf1234567890aBcDeF12',
    value: '0x4563918244f40000', // 5 ETH
    gas: '0x5208',
    gasPrice: '0x3b9aca00',
    input: '0x'
  },

  // Token transfer event
  tokenTransferLog: {
    address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer event
      '0x000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f7f123', // from
      '0x0000000000000000000000008a3b1c4d5e6f7890abcdef1234567890abcdef12'  // to
    ],
    data: '0x0000000000000000000000000000000000000000000000000de0b6b3a7640000', // 1 token
    blockNumber: '0x1c9c364',
    transactionHash: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
    transactionIndex: '0x2',
    blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    logIndex: '0x0',
    removed: false
  },

  // New contract deployment
  contractCreation: {
    hash: '0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
    nonce: '0x0',
    blockHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    blockNumber: '0x1c9c364',
    transactionIndex: '0x3',
    from: '0x742d35Cc6634C0532925a3b844Bc9e7595f7F123',
    to: null, // Contract creation
    value: '0x0',
    gas: '0x7a120',
    gasPrice: '0x3b9aca00',
    input: '0x608060405234801561001057600080fd5b50...' // Contract bytecode
  },

  // Block with transactions
  block: {
    number: '0x1c9c364',
    hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    parentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    timestamp: '0x6681a8f9',
    transactions: [
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      '0xdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd'
    ]
  }
};

// Helper to create RPC mock responses
export function createRPCMockResponse(method: string, params?: any[]) {
  switch (method) {
    case 'eth_blockNumber':
      return {
        jsonrpc: '2.0',
        id: 1,
        result: mockRPCResponses.blockNumber
      };

    case 'eth_gasPrice':
      return {
        jsonrpc: '2.0',
        id: 1,
        result: mockRPCResponses.gasPrice
      };

    case 'eth_getBalance':
      return {
        jsonrpc: '2.0',
        id: 1,
        result: mockRPCResponses.balance
      };

    case 'eth_getTransactionByHash':
      return {
        jsonrpc: '2.0',
        id: 1,
        result: mockRPCResponses.largeTransaction
      };

    case 'eth_getLogs':
      return {
        jsonrpc: '2.0',
        id: 1,
        result: [mockRPCResponses.tokenTransferLog]
      };

    case 'eth_getBlockByNumber':
      return {
        jsonrpc: '2.0',
        id: 1,
        result: mockRPCResponses.block
      };

    default:
      return {
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      };
  }
}

// Mock viem client
export class MockViemClient {
  async getBlockNumber() {
    return BigInt(parseInt(mockRPCResponses.blockNumber, 16));
  }

  async getGasPrice() {
    return BigInt(parseInt(mockRPCResponses.gasPrice, 16));
  }

  async getBalance({ address }: { address: string }) {
    return BigInt(parseInt(mockRPCResponses.balance, 16));
  }

  async getTransaction({ hash }: { hash: string }) {
    return mockRPCResponses.largeTransaction;
  }

  async getLogs({ address, event, fromBlock, toBlock }: any) {
    return [mockRPCResponses.tokenTransferLog];
  }

  async getBlock({ blockNumber }: { blockNumber?: bigint }) {
    return mockRPCResponses.block;
  }
}