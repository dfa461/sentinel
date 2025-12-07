#!/usr/bin/env python3
"""
Test script to debug .patch extraction from GitHub API
"""
import os
import asyncio
import httpx
import re
from dotenv import load_dotenv

load_dotenv()

async def test_patch_extraction():
    """Test what GitHub API returns for patch requests"""
    github_token = os.getenv("GITHUB_TOKEN")
    if not github_token:
        print("=" * 70)
        print("ERROR: GITHUB_TOKEN not found in environment")
        print("=" * 70)
        print("\nTo test patch extraction, you need to:")
        print("1. Create a .env file (copy from .env.example)")
        print("2. Add your GitHub token from: https://github.com/settings/tokens")
        print("\nFor now, showing expected .patch format based on git standards:")
        print("-" * 70)
        print("""
GitHub .patch format should look like:

From 1234567890abcdef1234567890abcdef12345678 Mon Sep 17 00:00:00 2001
From: Author Name <author@example.com>
Date: Mon, 1 Jan 2024 12:00:00 +0000
Subject: [PATCH] Commit message here

---
 file.py | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

diff --git a/file.py b/file.py
index abc123..def456 100644
--- a/file.py
+++ b/file.py
@@ -1,1 +1,1 @@
-old line
+new line

The email is in the "From:" line in format: From: Name <email@example.com>
        """)
        print("-" * 70)
        print("\nTesting regex patterns against this format...")

        sample_patch = """From 1234567890abcdef1234567890abcdef12345678 Mon Sep 17 00:00:00 2001
From: John Doe <john.doe@example.com>
Date: Mon, 1 Jan 2024 12:00:00 +0000
Subject: [PATCH] Add new feature

---
 file.py | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
"""

        # Test regex patterns
        print("\n1. Original regex: r'From:\\s*[^<]*<([^>]+)>'")
        match = re.search(r'From:\s*[^<]*<([^>]+)>', sample_patch, re.MULTILINE)
        if match:
            print(f"   ✓ MATCH: {match.group(1)}")
        else:
            print("   ✗ NO MATCH")

        return

    client = httpx.AsyncClient(
        headers={
            "Authorization": f"token {github_token}",
            "Accept": "application/vnd.github.v3+json"
        },
        timeout=30.0
    )

    # Test with a known public repo
    test_username = "torvalds"  # Linus Torvalds as a test case
    test_repo = "linux"

    try:
        print(f"Fetching commits from {test_username}/{test_repo}...")

        # Get recent commits
        response = await client.get(
            f"https://api.github.com/repos/{test_username}/{test_repo}/commits",
            params={"per_page": 1, "author": test_username}
        )

        if response.status_code != 200:
            print(f"Failed to get commits: {response.status_code}")
            print(response.text)
            return

        commits = response.json()
        if not commits:
            print("No commits found")
            return

        commit = commits[0]
        sha = commit["sha"]

        print(f"\nCommit SHA: {sha}")
        print(f"Commit message: {commit['commit']['message'][:50]}...")

        # Test 1: Request with patch accept header
        print("\n" + "="*60)
        print("TEST 1: Using Accept: application/vnd.github.v3.patch")
        print("="*60)

        patch_response = await client.get(
            f"https://api.github.com/repos/{test_username}/{test_repo}/commits/{sha}",
            headers={"Accept": "application/vnd.github.v3.patch"}
        )

        print(f"Status: {patch_response.status_code}")
        print(f"Content-Type: {patch_response.headers.get('content-type')}")
        print(f"\nFirst 1000 chars of response:")
        print("-" * 60)
        print(patch_response.text[:1000])
        print("-" * 60)

        # Test 2: Check commit API JSON response
        print("\n" + "="*60)
        print("TEST 2: Using JSON API to check author info")
        print("="*60)

        json_response = await client.get(
            f"https://api.github.com/repos/{test_username}/{test_repo}/commits/{sha}"
        )

        if json_response.status_code == 200:
            data = json_response.json()
            print(f"Author name: {data['commit']['author']['name']}")
            print(f"Author email: {data['commit']['author']['email']}")
            print(f"Committer name: {data['commit']['committer']['name']}")
            print(f"Committer email: {data['commit']['committer']['email']}")

        # Test the regex pattern
        print("\n" + "="*60)
        print("TEST 3: Testing regex extraction")
        print("="*60)

        patch_text = patch_response.text

        # Current regex
        email_match = re.search(
            r'From:\s*[^<]*<([^>]+)>',
            patch_text,
            re.MULTILINE
        )

        if email_match:
            print(f"✓ Current regex FOUND email: {email_match.group(1)}")
        else:
            print("✗ Current regex found NO match")

            # Try alternative patterns
            print("\nTrying alternative regex patterns:")

            # Pattern 1: Look for email in From line without angle brackets
            alt1 = re.search(r'From:\s*(.+?)$', patch_text, re.MULTILINE)
            if alt1:
                print(f"  Alt 1 (From: line): {alt1.group(1)}")

            # Pattern 2: Look for email pattern anywhere
            alt2 = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', patch_text)
            if alt2:
                print(f"  Alt 2 (any email): {alt2.group(0)}")

            # Pattern 3: Check if it's using different format
            alt3 = re.search(r'Author:\s*([^<]*)<([^>]+)>', patch_text, re.MULTILINE)
            if alt3:
                print(f"  Alt 3 (Author: line): {alt3.group(2)}")

    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(test_patch_extraction())
