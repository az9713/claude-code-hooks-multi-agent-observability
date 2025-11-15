#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from utils.constants import ensure_session_log_dir
from utils.tool_analyzer import analyze_tool_result

def send_tool_analytics(analytics_data, server_url='http://localhost:4000/api/analytics/tools'):
    """Send tool analytics data to the observability server."""
    try:
        req = urllib.request.Request(
            server_url,
            data=json.dumps(analytics_data).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'Claude-Code-Hook/1.0'
            }
        )

        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status == 200 or response.status == 201

    except (urllib.error.URLError, Exception):
        # Silently fail - don't block hook execution
        return False


def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)

        # Extract session_id
        session_id = input_data.get('session_id', 'unknown')

        # Ensure session log directory exists
        log_dir = ensure_session_log_dir(session_id)
        log_path = log_dir / 'post_tool_use.json'

        # Read existing log data or initialize empty list
        if log_path.exists():
            with open(log_path, 'r') as f:
                try:
                    log_data = json.load(f)
                except (json.JSONDecodeError, ValueError):
                    log_data = []
        else:
            log_data = []

        # Append new data
        log_data.append(input_data)

        # Write back to file with formatting
        with open(log_path, 'w') as f:
            json.dump(log_data, f, indent=2)

        # Analyze tool result and send analytics
        tool_name = input_data.get('tool_name', 'Unknown')
        tool_result = input_data.get('tool_result')
        source_app = os.getenv('SOURCE_APP', 'unknown')

        if tool_result is not None:
            analysis = analyze_tool_result(tool_name, tool_result)

            analytics_data = {
                'source_app': source_app,
                'session_id': session_id,
                'tool_name': tool_name,
                'success': analysis['success'],
                'error_type': analysis['error_type'],
                'error_message': analysis['error_message'],
                'timestamp': input_data.get('timestamp', 0)
            }

            send_tool_analytics(analytics_data)

        sys.exit(0)

    except json.JSONDecodeError:
        # Handle JSON decode errors gracefully
        sys.exit(0)
    except Exception:
        # Exit cleanly on any other error
        sys.exit(0)

if __name__ == '__main__':
    main()