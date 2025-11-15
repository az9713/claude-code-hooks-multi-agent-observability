#!/usr/bin/env python3
"""
Token counting and cost estimation utility
"""

# Model pricing per 1M tokens (as of Jan 2025)
MODEL_PRICING = {
    'claude-sonnet-4-5': {
        'input': 3.00,   # $3 per 1M input tokens
        'output': 15.00  # $15 per 1M output tokens
    },
    'claude-sonnet-4-20250514': {
        'input': 3.00,
        'output': 15.00
    },
    'claude-opus-4': {
        'input': 15.00,
        'output': 75.00
    },
    'claude-opus-4-20250514': {
        'input': 15.00,
        'output': 75.00
    },
    'claude-haiku-4': {
        'input': 0.25,
        'output': 1.25
    },
    'claude-3-5-sonnet-20241022': {
        'input': 3.00,
        'output': 15.00
    },
    'claude-3-5-haiku-20241022': {
        'input': 0.80,
        'output': 4.00
    },
    'claude-3-opus-20240229': {
        'input': 15.00,
        'output': 75.00
    },
}

def estimate_tokens(text):
    """
    Estimate token count from text.
    Rough approximation: 1 token ≈ 4 characters or 0.75 words
    """
    if not text:
        return 0

    # Count by characters (more reliable)
    return len(text) // 4


def count_tokens_in_messages(messages):
    """
    Count total tokens in a list of chat messages.

    Args:
        messages: List of message objects with 'content' field

    Returns:
        tuple: (input_tokens, output_tokens)
    """
    input_tokens = 0
    output_tokens = 0

    for msg in messages:
        if not isinstance(msg, dict):
            continue

        role = msg.get('type', '')
        content = msg.get('content', '')

        # Extract text from content if it's a list
        if isinstance(content, list):
            text_content = ''
            for item in content:
                if isinstance(item, dict):
                    if item.get('type') == 'text':
                        text_content += item.get('text', '')
                    elif 'text' in item:
                        text_content += item['text']
            content = text_content

        tokens = estimate_tokens(str(content))

        # Classify as input or output based on role
        if role in ['user', 'human']:
            input_tokens += tokens
        elif role in ['assistant', 'ai']:
            output_tokens += tokens
        else:
            # For unknown roles, count as input
            input_tokens += tokens

    return input_tokens, output_tokens


def estimate_cost(input_tokens, output_tokens, model_name):
    """
    Calculate estimated cost based on token counts and model.

    Args:
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        model_name: Name of the model used

    Returns:
        float: Estimated cost in USD
    """
    if not model_name:
        return 0.0

    # Normalize model name (remove version suffixes for lookup)
    model_key = model_name.lower()

    # Find matching pricing
    pricing = None
    for key, value in MODEL_PRICING.items():
        if key.lower() in model_key or model_key in key.lower():
            pricing = value
            break

    if not pricing:
        # Default to Sonnet pricing if unknown
        pricing = MODEL_PRICING['claude-sonnet-4-5']

    # Calculate cost (pricing is per 1M tokens)
    input_cost = (input_tokens / 1_000_000) * pricing['input']
    output_cost = (output_tokens / 1_000_000) * pricing['output']

    return input_cost + output_cost


def count_tokens_in_transcript(transcript_data):
    """
    Count tokens from a chat transcript (list of messages).

    Args:
        transcript_data: List of message objects

    Returns:
        dict: {
            'input_tokens': int,
            'output_tokens': int,
            'total_tokens': int
        }
    """
    if not transcript_data:
        return {'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0}

    input_tokens, output_tokens = count_tokens_in_messages(transcript_data)

    return {
        'input_tokens': input_tokens,
        'output_tokens': output_tokens,
        'total_tokens': input_tokens + output_tokens
    }
