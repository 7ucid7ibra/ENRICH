#!/usr/bin/env python3
"""
Usage:
    python emit_git_evidence.py [--max-commits N] [--since-days N]

    Run from the root of a Git repository to extract commit history.

    --max-commits: Maximum number of commits to extract (default: 300)
    --since-days: Extract commits from the last N days (mutually exclusive with --max-commits)

    Outputs a JSON file to ~/Desktop/evidence_outbox/
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="Extract Git commit history as JSON")
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--max-commits', type=int, default=300, help='Maximum commits to extract')
    group.add_argument('--since-days', type=int, help='Extract commits from last N days')
    args = parser.parse_args()

    # Verify current directory is a Git repository
    if not os.path.isdir('.git'):
        print("Error: Current directory is not a Git repository", file=sys.stderr)
        sys.exit(1)

    # Get repository details
    repo_path = os.getcwd()
    project = os.path.basename(repo_path)

    # Determine git log arguments
    git_args = ['git', 'log', '--pretty=format:%h|%ad|%aI|%s', '--date=short', '--name-only']
    if args.since_days:
        git_args.extend(['--since', f'{args.since_days} days ago'])
    else:
        git_args.extend(['--max-count', str(args.max_commits)])

    # Run git log command
    try:
        result = subprocess.run(git_args, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error running git log: {e}", file=sys.stderr)
        sys.exit(1)

    # Parse git log output
    lines = result.stdout.strip().split('\n')
    commits = []
    current_commit = None
    for line in lines:
        if '|' in line and len(line.split('|')) == 4:
            # New commit line: hash|date|timestamp|message
            if current_commit:
                commits.append(current_commit)
            parts = line.split('|', 3)
            current_commit = {
                'hash': parts[0],
                'date': parts[1],
                'timestamp': parts[2],
                'message': parts[3],
                'files': []
            }
        elif line.strip() and current_commit is not None:
            # File line
            current_commit['files'].append(line.strip())
    if current_commit:
        commits.append(current_commit)

    # Prepare output data
    data = {
        'source': 'git_backfill',
        'project': project,
        'repo_path': repo_path,
        'generated_at': datetime.now().isoformat(),
        'commit_count': len(commits),
        'commits': commits
    }

    # Create output directory if needed
    outbox = Path.home() / 'Desktop' / 'evidence_outbox' / 'evidence'
    outbox.mkdir(parents=True, exist_ok=True)

    # Generate filename
    timestamp_str = datetime.now().strftime('%Y-%m-%d_%H%M%S')
    filename = f"{project}__git_backfill__{timestamp_str}.json"
    filepath = outbox / filename

    # Write JSON file
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Evidence extracted to {filepath}")

if __name__ == '__main__':
    main()