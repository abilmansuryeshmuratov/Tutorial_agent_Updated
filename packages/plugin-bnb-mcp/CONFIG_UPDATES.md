# BNB MCP Plugin - Configuration Updates for Content Generation

## Environment Variables for Enhanced Content Generation

Add these to your `.env` file for better content generation:

```bash
# Content Generation Parameters
CONTENT_TEMPERATURE=0.85          # Higher for more creative content (default: 0.85)
CONTENT_PRESENCE_PENALTY=0.5      # Reduces repetition (default: 0.5)
ENABLE_PERSONALITY_ENHANCEMENT=true # Enable personality injection

# Character Configuration (optional)
CHARACTER_SARCASM_LEVEL=high      # low, medium, high
CHARACTER_TECHNICAL_DEPTH=medium  # low, medium, high
```

## Character Configuration Updates

If using a custom character file, ensure these settings in your character JSON:

```json
{
  "modelConfig": {
    "temperature": 0.85,
    "maxOutputTokens": 1024,
    "frequency_penalty": 0.3,
    "presence_penalty": 0.5,
    "top_p": 0.95
  },
  "settings": {
    "twitter": {
      "contentStyle": "sarcastic_analytical",
      "usePersonalityEnhancement": true,
      "varietyThreshold": 0.7
    }
  }
}
```

## Example Character Personality Traits

The plugin now uses these personality traits from the Tutorial Agent character:
- Sarcastic commentary on obvious scams
- Technical depth with street-smart observations
- Lowercase emphasis for casual confidence
- Crypto-native language (gm, ngmi, wagmi, etc.)
- Market psychology insights

## Content Examples

### Before (Dry):
```
Large BNB transfer detected: 1000 BNB moved from 0x123...abc to 0x456...def
#BNBChain #Crypto
```

### After (Personality-Enhanced):
```
anons, whale just moved 1000 BNB from 0x123...abc. tracking this degen.

either genius or about to get rekt. probably nothing.

#WhaleAlert #BNBChain
```

## Fallback Content (No OpenAI Key)

The plugin now generates personality-driven content even without OpenAI:
- Uses character-specific templates
- Maintains consistent voice
- Adds variety to prevent repetition
- Includes technical context when relevant

## Testing Content Generation

To test the personality improvements:

```bash
# Test without OpenAI key
unset OPENAI_API_KEY
npm test tests/unit/plugins/bnb-mcp/personality-content.test.ts

# Test with OpenAI key
export OPENAI_API_KEY=your-key
npm test tests/unit/plugins/bnb-mcp/personality-content.test.ts
```