#!/usr/bin/env python3
"""
GitHub Email and Social Profile Extractor

Extracts publicly available emails and X/Twitter profiles from GitHub
contributors, members, or specific commits.

Usage:
    python github_extractor.py <github_url>

Examples:
    python github_extractor.py https://github.com/VectorInstitute
    python github_extractor.py https://github.com/owner/repo
    python github_extractor.py https://github.com/owner/repo/commit/abc123

Note: Requires GITHUB_TOKEN environment variable for higher rate limits.
"""

import requests
import re
import sys
import os
from urllib.parse import urlparse
from collections import defaultdict
import json
import time


class GitHubExtractor:
    def __init__(self, github_token=None):
        self.session = requests.Session()
        self.headers = {
            'Accept': 'application/vnd.github.v3+json',
        }
        if github_token:
            self.headers['Authorization'] = f'token {github_token}'
        self.session.headers.update(self.headers)
        self.base_url = 'https://api.github.com'

    def parse_github_url(self, url):
        """Parse GitHub URL to determine type and extract components."""
        parsed = urlparse(url)
        path_parts = [p for p in parsed.path.split('/') if p]

        if len(path_parts) == 0:
            return None, None

        if len(path_parts) == 1:
            # Organization or user
            return 'org', {'name': path_parts[0]}
        elif len(path_parts) == 2:
            # Repository
            return 'repo', {'owner': path_parts[0], 'name': path_parts[1]}
        elif len(path_parts) >= 4 and path_parts[2] == 'commit':
            # Specific commit
            return 'commit', {
                'owner': path_parts[0],
                'repo': path_parts[1],
                'sha': path_parts[3]
            }
        else:
            return 'repo', {'owner': path_parts[0], 'name': path_parts[1]}

    def get_with_pagination(self, url, params=None):
        """Fetch all pages from a paginated API endpoint."""
        if params is None:
            params = {}
        params['per_page'] = 100

        results = []
        page = 1

        while True:
            params['page'] = page
            response = self.session.get(url, params=params)

            if response.status_code == 403:
                rate_limit = response.headers.get('X-RateLimit-Remaining', '0')
                if rate_limit == '0':
                    reset_time = int(response.headers.get('X-RateLimit-Reset', 0))
                    wait_time = reset_time - int(time.time()) + 5
                    print(f"Rate limit exceeded. Waiting {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"Access forbidden: {response.json().get('message', 'Unknown error')}")
                    break

            if response.status_code != 200:
                print(f"Error: {response.status_code} - {response.json().get('message', 'Unknown error')}")
                break

            data = response.json()
            if not data:
                break

            results.extend(data)

            # Check if there are more pages
            if 'Link' not in response.headers or 'rel="next"' not in response.headers['Link']:
                break

            page += 1
            print(f"  Fetching page {page}...", end='\r')

        return results

    def get_user_details(self, username):
        """Fetch detailed information for a specific user."""
        url = f"{self.base_url}/users/{username}"
        response = self.session.get(url)

        if response.status_code == 200:
            return response.json()
        return None

    def get_user_repos(self, username):
        """Get user's public repositories."""
        url = f"{self.base_url}/users/{username}/repos"
        params = {'type': 'owner', 'sort': 'updated', 'per_page': 5}
        response = self.session.get(url, params=params)

        if response.status_code == 200:
            return response.json()
        return []

    def extract_email_from_commits(self, username):
        """
        Extract email address from commit data
        Fetches recent commits and extracts author email from commit metadata
        """
        repos = self.get_user_repos(username)

        if not repos:
            return None

        # Try up to 5 repos (sorted by most recently updated)
        for repo in repos[:5]:
            repo_name = repo["name"]

            try:
                # Get recent commits from this repo
                url = f"{self.base_url}/repos/{username}/{repo_name}/commits"
                params = {"per_page": 5, "author": username}
                response = self.session.get(url, params=params)

                if response.status_code == 200:
                    commits = response.json()

                    # Try each commit
                    for commit in commits:
                        try:
                            # Extract email from commit author data
                            # The email is in commit.commit.author.email
                            author_email = commit.get("commit", {}).get("author", {}).get("email")

                            if author_email:
                                # Filter out noreply emails
                                if "noreply" not in author_email.lower() and "@" in author_email:
                                    print(f"   ✉️  Found email from commit: {author_email}")
                                    return author_email

                        except Exception as e:
                            sha = commit.get("sha", "unknown")[:7]
                            print(f"   Error extracting email from commit {sha}: {e}")
                            continue

                time.sleep(0.5)  # Rate limiting

            except Exception as e:
                print(f"   Error checking commits in {repo_name}: {e}")
                continue

        print(f"   ⚠️  No email found in commits for {username}")
        return None

    def extract_user_info(self, user_data):
        """Extract relevant information from user data."""
        if not user_data:
            return None

        username = user_data.get('login')
        profile_email = user_data.get('email')

        # If no email in profile, try to extract from commits
        extracted_email = profile_email
        if not profile_email and username:
            print(f"   📧 No public email in profile for {username}, checking commits...")
            extracted_email = self.extract_email_from_commits(username)

        info = {
            'username': username,
            'name': user_data.get('name'),
            'email': extracted_email,
            'twitter': user_data.get('twitter_username'),
            'blog': user_data.get('blog'),
            'bio': user_data.get('bio'),
            'company': user_data.get('company'),
            'location': user_data.get('location'),
            'profile_url': user_data.get('html_url'),
        }

        return info

    def get_org_members(self, org_name):
        """Get all public members of an organization."""
        print(f"\nFetching members of organization: {org_name}")
        url = f"{self.base_url}/orgs/{org_name}/members"
        members = self.get_with_pagination(url)
        print(f"Found {len(members)} members")
        return members

    def get_org_repos(self, org_name):
        """Get all repositories of an organization."""
        print(f"\nFetching repositories of organization: {org_name}")
        url = f"{self.base_url}/orgs/{org_name}/repos"
        repos = self.get_with_pagination(url)
        print(f"Found {len(repos)} repositories")
        return repos

    def get_repo_contributors(self, owner, repo):
        """Get all contributors to a repository."""
        print(f"\nFetching contributors for {owner}/{repo}")
        url = f"{self.base_url}/repos/{owner}/{repo}/contributors"
        contributors = self.get_with_pagination(url)
        print(f"Found {len(contributors)} contributors")
        return contributors

    def get_commit_details(self, owner, repo, sha):
        """Get details of a specific commit."""
        print(f"\nFetching commit {sha[:7]} from {owner}/{repo}")
        url = f"{self.base_url}/repos/{owner}/{repo}/commits/{sha}"
        response = self.session.get(url)

        if response.status_code == 200:
            return response.json()
        return None

    def extract_from_commit(self, commit_data):
        """Extract author and committer info from commit data."""
        results = []

        # Extract author
        if commit_data.get('author'):
            author_info = self.get_user_details(commit_data['author']['login'])
            if author_info:
                results.append(self.extract_user_info(author_info))

        # Also check commit email
        if commit_data.get('commit', {}).get('author'):
            commit_author = commit_data['commit']['author']
            results.append({
                'username': None,
                'name': commit_author.get('name'),
                'email': commit_author.get('email'),
                'twitter': None,
                'source': 'commit_metadata'
            })

        return results

    def process_url(self, github_url):
        """Main method to process a GitHub URL and extract information."""
        url_type, components = self.parse_github_url(github_url)

        if not url_type:
            print("Invalid GitHub URL")
            return []

        all_users = {}

        if url_type == 'org':
            # Get organization members
            members = self.get_org_members(components['name'])

            print("\nFetching detailed information for each member...")
            for i, member in enumerate(members, 1):
                print(f"  Processing member {i}/{len(members)}: {member['login']}", end='\r')
                user_details = self.get_user_details(member['login'])
                user_info = self.extract_user_info(user_details)
                if user_info:
                    all_users[user_info['username']] = user_info
            print()

            # Also get contributors from all org repos
            print("\nDo you want to also fetch contributors from all org repositories? (y/n): ", end='')
            # For automation, we'll skip this prompt. Uncomment if interactive use is needed.
            # choice = input().lower()
            # if choice == 'y':
            #     repos = self.get_org_repos(components['name'])
            #     for repo in repos[:5]:  # Limit to first 5 repos for demo
            #         contributors = self.get_repo_contributors(components['name'], repo['name'])
            #         for contributor in contributors:
            #             if contributor['login'] not in all_users:
            #                 user_details = self.get_user_details(contributor['login'])
            #                 user_info = self.extract_user_info(user_details)
            #                 if user_info:
            #                     all_users[user_info['username']] = user_info

        elif url_type == 'repo':
            # Get repository contributors
            contributors = self.get_repo_contributors(components['owner'], components['name'])

            print("\nFetching detailed information for each contributor...")
            for i, contributor in enumerate(contributors, 1):
                print(f"  Processing contributor {i}/{len(contributors)}: {contributor['login']}", end='\r')
                user_details = self.get_user_details(contributor['login'])
                user_info = self.extract_user_info(user_details)
                if user_info:
                    all_users[user_info['username']] = user_info
            print()

        elif url_type == 'commit':
            # Get specific commit details
            commit_data = self.get_commit_details(
                components['owner'],
                components['repo'],
                components['sha']
            )

            if commit_data:
                commit_users = self.extract_from_commit(commit_data)
                for user_info in commit_users:
                    if user_info and user_info.get('username'):
                        all_users[user_info['username']] = user_info

        return list(all_users.values())

    def display_results(self, users):
        """Display extracted information in a formatted way."""
        print("\n" + "="*80)
        print("EXTRACTED CONTACT INFORMATION")
        print("="*80)

        users_with_email = [u for u in users if u.get('email')]
        users_with_twitter = [u for u in users if u.get('twitter')]

        print(f"\nTotal users found: {len(users)}")
        print(f"Users with email: {len(users_with_email)}")
        print(f"Users with Twitter/X: {len(users_with_twitter)}")

        print("\n" + "-"*80)
        print("DETAILED INFORMATION")
        print("-"*80)

        for user in users:
            print(f"\n👤 {user.get('name') or user.get('username') or 'Unknown'}")
            print(f"   Username: {user.get('username') or 'N/A'}")
            if user.get('email'):
                print(f"   📧 Email: {user['email']}")
            if user.get('twitter'):
                print(f"   🐦 Twitter/X: @{user['twitter']}")
                print(f"      Profile: https://twitter.com/{user['twitter']}")
            if user.get('company'):
                print(f"   🏢 Company: {user['company']}")
            if user.get('location'):
                print(f"   📍 Location: {user['location']}")
            if user.get('blog'):
                print(f"   🌐 Website: {user['blog']}")
            if user.get('profile_url'):
                print(f"   🔗 GitHub: {user['profile_url']}")

        # Summary lists
        if users_with_email:
            print("\n" + "="*80)
            print("EMAIL ADDRESSES ONLY")
            print("="*80)
            for user in users_with_email:
                print(f"{user['email']} ({user.get('name') or user.get('username')})")

        if users_with_twitter:
            print("\n" + "="*80)
            print("TWITTER/X HANDLES ONLY")
            print("="*80)
            for user in users_with_twitter:
                print(f"@{user['twitter']} ({user.get('name') or user.get('username')})")

    def export_to_json(self, users, filename='github_contacts.json'):
        """Export results to JSON file."""
        with open(filename, 'w') as f:
            json.dump(users, f, indent=2)
        print(f"\n✅ Results exported to {filename}")

    def export_to_csv(self, users, filename='github_contacts.csv'):
        """Export results to CSV file."""
        import csv

        if not users:
            return

        fieldnames = ['username', 'name', 'email', 'twitter', 'company', 'location', 'blog', 'profile_url']

        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for user in users:
                writer.writerow({k: user.get(k, '') for k in fieldnames})

        print(f"✅ Results exported to {filename}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python github_extractor.py <github_url>")
        print("\nExamples:")
        print("  python github_extractor.py https://github.com/VectorInstitute")
        print("  python github_extractor.py https://github.com/owner/repo")
        print("  python github_extractor.py https://github.com/owner/repo/commit/abc123")
        print("\nNote: Set GITHUB_TOKEN environment variable for higher rate limits")
        sys.exit(1)

    github_url = sys.argv[1]
    github_token = os.environ.get('GITHUB_TOKEN')

    if not github_token:
        print("⚠️  Warning: No GITHUB_TOKEN found. Rate limits will be lower.")
        print("   Set it with: export GITHUB_TOKEN=your_token_here")
        print()

    extractor = GitHubExtractor(github_token)
    users = extractor.process_url(github_url)

    if users:
        extractor.display_results(users)

        # Export options
        print("\n" + "="*80)
        extractor.export_to_json(users)
        extractor.export_to_csv(users)
    else:
        print("\n❌ No users found or unable to fetch data.")


if __name__ == '__main__':
    main()
