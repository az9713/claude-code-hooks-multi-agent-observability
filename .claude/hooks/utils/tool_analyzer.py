#!/usr/bin/env python3
"""
Tool analytics utility for analyzing tool success/failure
"""

def classify_error(error_message):
    """
    Classify error type based on error message content.

    Args:
        error_message: Error message string

    Returns:
        str: Error classification
    """
    if not error_message:
        return 'unknown_error'

    error_lower = str(error_message).lower()

    # Permission errors
    if any(word in error_lower for word in ['permission denied', 'access denied', 'forbidden', 'eacces']):
        return 'permission_error'

    # File not found errors
    if any(word in error_lower for word in ['not found', 'no such file', 'enoent', 'does not exist']):
        return 'not_found_error'

    # Timeout errors
    if any(word in error_lower for word in ['timeout', 'timed out', 'time limit']):
        return 'timeout_error'

    # Syntax errors
    if any(word in error_lower for word in ['syntax error', 'syntaxerror', 'invalid syntax']):
        return 'syntax_error'

    # Network errors
    if any(word in error_lower for word in ['connection refused', 'network', 'unreachable', 'connection reset']):
        return 'network_error'

    # Command not found
    if any(word in error_lower for word in ['command not found', 'not recognized']):
        return 'command_not_found'

    # Memory errors
    if any(word in error_lower for word in ['out of memory', 'memory error', 'cannot allocate']):
        return 'memory_error'

    # Disk errors
    if any(word in error_lower for word in ['no space left', 'disk full', 'quota exceeded']):
        return 'disk_error'

    # Invalid argument
    if any(word in error_lower for word in ['invalid argument', 'bad argument', 'illegal option']):
        return 'invalid_argument'

    return 'unknown_error'


def extract_error_message(tool_result):
    """
    Extract error message from tool result.

    Args:
        tool_result: Tool result object or string

    Returns:
        str: Error message or None
    """
    if not tool_result:
        return None

    # If it's a string, check if it contains error indicators
    if isinstance(tool_result, str):
        if any(word in tool_result.lower() for word in ['error', 'failed', 'exception']):
            return tool_result[:500]  # Limit to 500 chars
        return None

    # If it's a dict, look for error field
    if isinstance(tool_result, dict):
        # Check common error fields
        for key in ['error', 'error_message', 'stderr', 'message']:
            if key in tool_result:
                msg = tool_result[key]
                if msg:
                    return str(msg)[:500]

        # Check if there's an 'output' field with error content
        if 'output' in tool_result:
            output = str(tool_result['output'])
            if any(word in output.lower() for word in ['error', 'failed', 'exception']):
                return output[:500]

    return None


def is_tool_success(tool_result):
    """
    Determine if a tool execution was successful.

    Args:
        tool_result: Tool result object

    Returns:
        bool: True if successful, False if failed
    """
    if tool_result is None:
        return False

    # If it's a dict, check for explicit success/error fields
    if isinstance(tool_result, dict):
        # Check for explicit success field
        if 'success' in tool_result:
            return bool(tool_result['success'])

        # Check for error field
        if 'error' in tool_result and tool_result['error']:
            return False

        # Check for error_message field
        if 'error_message' in tool_result and tool_result['error_message']:
            return False

        # Check exit code
        if 'exit_code' in tool_result:
            return tool_result['exit_code'] == 0

        if 'code' in tool_result:
            return tool_result['code'] == 0

    # If it's a string, check for error indicators
    if isinstance(tool_result, str):
        error_indicators = ['error', 'failed', 'exception', 'traceback']
        result_lower = tool_result.lower()
        for indicator in error_indicators:
            if indicator in result_lower:
                return False

    # Default to success if no error indicators found
    return True


def analyze_tool_result(tool_name, tool_result):
    """
    Analyze tool result and return success/failure information.

    Args:
        tool_name: Name of the tool
        tool_result: Tool result object

    Returns:
        dict: {
            'success': bool,
            'error_type': str or None,
            'error_message': str or None
        }
    """
    success = is_tool_success(tool_result)

    if success:
        return {
            'success': True,
            'error_type': None,
            'error_message': None
        }

    # Extract error information
    error_message = extract_error_message(tool_result)
    error_type = classify_error(error_message)

    return {
        'success': False,
        'error_type': error_type,
        'error_message': error_message
    }
