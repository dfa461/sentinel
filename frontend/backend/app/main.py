from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
import re
from datetime import datetime
from dotenv import load_dotenv
from xai_sdk import AsyncClient
from xai_sdk.chat import user, system
from xdk import Client as XClient
import httpx
from .rl_assessment import router as rl_router

load_dotenv()

app = FastAPI(title="Sentinel Assessment API")

# Include RL router
app.include_router(rl_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Grok API configuration
GROK_API_KEY = os.getenv("GROK_API_KEY")

# X API configuration
X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN")

# Create global xAI client
xai_client = AsyncClient(api_key=GROK_API_KEY)

# Create global X API client
x_client = None
if X_BEARER_TOKEN:
    x_client = XClient(bearer_token=X_BEARER_TOKEN)


# Models removed - no longer needed since AssessmentPage was removed
# InteractiveAssessmentPage uses RL-specific endpoints in rl_assessment.py


class RoleSearchRequest(BaseModel):
    role_description: str
    max_results: Optional[int] = 10


class CandidatePost(BaseModel):
    username: str
    post_text: str
    post_url: str
    github_links: List[str]
    relevance_score: Optional[float] = None


async def expand_short_url(short_url: str) -> str:
    """Expand t.co or other shortened URLs to get the actual destination"""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            response = await client.head(short_url)
            return str(response.url)
    except Exception as e:
        print(f"[URL Expand] Error expanding {short_url}: {e}")
        return short_url  # Return original if expansion fails


async def call_grok_api(messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
    """Call Grok API with the given messages"""
    if not GROK_API_KEY:
        raise HTTPException(status_code=500, detail="Grok API key not configured")

    try:
        # Convert simple dict messages to SDK objects
        sdk_messages = []
        for msg in messages:
            if msg["role"] == "user":
                sdk_messages.append(user(msg["content"]))
            elif msg["role"] == "system":
                sdk_messages.append(system(msg["content"]))
            # Add other roles if needed, but for now we mainly use user/system
        
        # Create chat session
        chat = xai_client.chat.create(
            model="grok-3",
            messages=sdk_messages,
            temperature=temperature
        )
        
        # Get response
        response = await chat.sample()
        return response.content

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grok API error: {str(e)}")


@app.get("/")
async def root():
    return {
        "name": "Sentinel Assessment API",
        "version": "1.0.0",
        "status": "operational",
    }


@app.post("/search-candidates")
async def search_candidates(request: RoleSearchRequest):
    """
    Discover candidates organically from X based on role description.
    Pipeline: JD parsing → keyword extraction → X search → bio analysis → GitHub extraction → relevance ranking
    """

    if not x_client:
        raise HTTPException(status_code=500, detail="X API not configured. Set X_BEARER_TOKEN environment variable.")

    try:
        # Stage 1: Parse Job Description and extract technical keywords using Grok
        print(f"[Stage 1] Parsing job description...")

        jd_parsing_prompt = f"""Analyze this job description and extract search keywords for finding candidates on X (Twitter):

Job Description: {request.role_description}

Extract:
1. Core technical skills (languages, frameworks, tools)
2. Domain keywords (ML, systems, frontend, etc.)
3. Seniority indicators (senior, staff, principal)
4. Specific technologies mentioned

Return ONLY a JSON object:
{{
    "primary_keywords": ["keyword1", "keyword2", "keyword3"],
    "technical_terms": ["term1", "term2"],
    "search_queries": ["query1 for X search", "query2 for X search", ...]
}}

The search_queries should be optimized for finding engineers on X who work in this domain."""

        jd_response = await call_grok_api(
            [{"role": "user", "content": jd_parsing_prompt}],
            temperature=0.3
        )

        # Parse JD analysis
        json_match = re.search(r'\{.*\}', jd_response, re.DOTALL)
        if not json_match:
            raise HTTPException(status_code=500, detail="Failed to parse job description")

        jd_profile = json.loads(json_match.group(0))
        print(f"[Stage 1] Keywords: {jd_profile.get('primary_keywords', [])}")
        print(f"[Stage 1] Search queries: {jd_profile.get('search_queries', [])}")

        # Stage 2: Discover candidates via X API search with progressive broadening
        print(f"[Stage 2] Discovering candidates via X search...")

        discovered_users = {}  # username -> {posts, bio, github_links}
        search_queries = jd_profile.get('search_queries', [])

        TARGET_USERS = request.max_results * 3  # Try to find 3x more users than needed
        MAX_USERS = 50  # Hard cap to avoid too many API calls

        # Progressive broadening strategy
        search_attempts = [
            {
                'queries': search_queries[:2],  # Most specific queries
                'suffix': ' github.com -is:retweet',  # Must have GitHub
                'max_results': 20,
                'description': 'Specific + GitHub required'
            },
            {
                'queries': search_queries[:3],  # Broader set of queries
                'suffix': ' -is:retweet',  # No GitHub requirement
                'max_results': 30,
                'description': 'Broader search, no GitHub filter'
            },
            {
                'queries': jd_profile.get('primary_keywords', [])[:2],  # Just keywords
                'suffix': ' -is:retweet',
                'max_results': 50,
                'description': 'Keyword-based, very broad'
            }
        ]

        for attempt in search_attempts:
            if len(discovered_users) >= TARGET_USERS:
                print(f"[Stage 2] Found enough users ({len(discovered_users)}), stopping search")
                break

            print(f"[Stage 2] Attempt: {attempt['description']}")

            for search_query in attempt['queries']:
                if len(discovered_users) >= MAX_USERS:
                    break

                try:
                    full_query = search_query + attempt['suffix']
                    print(f"[Stage 2] Searching: {full_query}")

                    # Search posts matching the query
                    for page in x_client.posts.search_recent(
                        query=full_query,
                        max_results=attempt['max_results'],
                        tweet_fields=["created_at", "text", "author_id"],
                        expansions=["author_id"],
                        user_fields=["username", "description"]
                    ):
                        # Access data from page
                        page_data = getattr(page, 'data', []) or []
                        includes = getattr(page, 'includes', {})
                        users_data = includes.get('users', []) if isinstance(includes, dict) else []

                        print(f"[Stage 2] Query '{full_query[:60]}...' -> {len(page_data)} posts")

                        for post in page_data:
                            if len(discovered_users) >= MAX_USERS:
                                break

                            # Handle both dict and object access
                            post_id = post.get('id') if isinstance(post, dict) else post.id
                            post_text = post.get('text') if isinstance(post, dict) else post.text
                            author_id = post.get('author_id') if isinstance(post, dict) else getattr(post, 'author_id', None)

                            # Get author username from includes
                            author_username = None
                            for user in users_data:
                                user_id = user.get('id') if isinstance(user, dict) else user.id
                                if user_id == author_id:
                                    author_username = user.get('username') if isinstance(user, dict) else user.username
                                    break

                            if not author_username:
                                continue

                            # Find all URLs in the post (including t.co)
                            all_urls = re.findall(r'https?://[^\s\)]+', post_text)
                            github_links = []

                            for url in all_urls:
                                if 'github.com' in url:
                                    github_links.append(url)
                                elif 't.co' in url:
                                    expanded_url = await expand_short_url(url)
                                    if 'github.com' in expanded_url:
                                        github_links.append(expanded_url)

                            # Build user profile
                            if author_username not in discovered_users:
                                discovered_users[author_username] = {
                                    'username': author_username,
                                    'posts': [],
                                    'github_links': set(),
                                    'bio': None,
                                    'matched_queries': []
                                }

                            # Add post to user profile
                            if github_links or len(post_text) > 100:  # Substantial technical posts
                                discovered_users[author_username]['posts'].append({
                                    'text': post_text,
                                    'id': post_id,
                                    'github_links': github_links
                                })
                                discovered_users[author_username]['github_links'].update(github_links)
                                if full_query not in discovered_users[author_username]['matched_queries']:
                                    discovered_users[author_username]['matched_queries'].append(full_query)

                        # Only get first page per query
                        break

                    print(f"[Stage 2] Query found {len(discovered_users)} total users so far")

                except Exception as e:
                    print(f"[Stage 2] Error with query '{search_query}': {e}")
                    continue

        print(f"[Stage 2] Discovered {len(discovered_users)} unique users")

        # Stage 3: Enrich with bio analysis
        print(f"[Stage 3] Fetching user bios...")

        usernames_to_lookup = list(discovered_users.keys())[:50]  # Limit API calls
        if usernames_to_lookup:
            try:
                users_response = x_client.users.get_by_usernames(
                    usernames=usernames_to_lookup,
                    user_fields=["description", "url", "public_metrics"]
                )

                for user in getattr(users_response, 'data', []) or []:
                    username = user.get('username') if isinstance(user, dict) else user.username
                    bio = user.get('description') if isinstance(user, dict) else getattr(user, 'description', '')

                    if username in discovered_users:
                        discovered_users[username]['bio'] = bio

                        # Extract GitHub from bio
                        bio_github = re.findall(r'github\.com/([^\s\)\/]+)', bio)
                        for gh_user in bio_github:
                            discovered_users[username]['github_links'].add(f"https://github.com/{gh_user}")

                print(f"[Stage 3] Enriched {len(usernames_to_lookup)} user profiles with bios")

            except Exception as e:
                print(f"[Stage 3] Error fetching bios: {e}")

        # Filter: Only keep users with GitHub links
        candidates_with_github = {
            user: data for user, data in discovered_users.items()
            if data['github_links']
        }

        print(f"[Stage 3] {len(candidates_with_github)} users have GitHub links")

        # Stage 4: Use Grok to rank candidates by relevance
        print(f"[Stage 4] Ranking candidates with Grok...")

        if candidates_with_github and GROK_API_KEY:
            try:
                # Build candidate summaries for Grok
                candidate_summaries = []
                for i, (username, data) in enumerate(list(candidates_with_github.items())[:20], 1):
                    summary = f"""Candidate {i} - @{username}
Bio: {data['bio'] or 'N/A'}
GitHub: {', '.join(list(data['github_links'])[:3])}
Sample Posts: {' | '.join([p['text'][:80] for p in data['posts'][:2]])}
Matched Queries: {', '.join(data['matched_queries'])}"""
                    candidate_summaries.append(summary)

                ranking_prompt = f"""Analyze these X users to find the best candidates for this role:

Role: {request.role_description}

Candidates:
{chr(10).join(candidate_summaries)}

Rate each candidate's relevance (0-10) based on:
1. Bio signals (current role, expertise mentioned)
2. Post content (technical depth, GitHub activity)
3. GitHub presence

Return ONLY a JSON array:
[
  {{"candidate": 1, "score": 9.0, "reason": "Active PyTorch contributor"}},
  {{"candidate": 2, "score": 7.5, "reason": "ML background, some relevant posts"}},
  ...
]

Include only candidates with score >= 6.0. Limit to top {request.max_results}."""

                grok_response = await call_grok_api(
                    [{"role": "user", "content": ranking_prompt}],
                    temperature=0.3
                )

                # Parse rankings
                json_match = re.search(r'\[.*\]', grok_response, re.DOTALL)
                if json_match:
                    rankings = json.loads(json_match.group(0))

                    # Apply scores
                    username_list = list(candidates_with_github.keys())
                    for ranking in rankings:
                        cand_idx = ranking['candidate'] - 1
                        if 0 <= cand_idx < len(username_list):
                            username = username_list[cand_idx]
                            candidates_with_github[username]['relevance_score'] = ranking['score']
                            candidates_with_github[username]['ranking_reason'] = ranking.get('reason', '')

                    print(f"[Stage 4] Ranked {len(rankings)} candidates")

            except Exception as e:
                print(f"[Stage 4] Error ranking with Grok: {e}")

        # Format final results
        results = []
        sorted_candidates = sorted(
            candidates_with_github.items(),
            key=lambda x: x[1].get('relevance_score', 0),
            reverse=True
        )[:request.max_results]

        for username, data in sorted_candidates:
            # Pick the best post to show
            best_post = data['posts'][0] if data['posts'] else {'text': '', 'id': ''}

            results.append(CandidatePost(
                username=username,
                post_text=best_post['text'],
                post_url=f"https://x.com/{username}",
                github_links=list(data['github_links']),
                relevance_score=data.get('relevance_score')
            ))

        return {
            "role_description": request.role_description,
            "jd_keywords": jd_profile.get('primary_keywords', []),
            "search_queries_used": search_queries,
            "candidates_found": len(results),
            "total_users_discovered": len(discovered_users),
            "users_with_github": len(candidates_with_github),
            "candidates": results
        }

    except Exception as e:
        print(f"Error searching candidates: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search candidates: {str(e)}")


@app.get("/test-x-search")
async def test_x_search():
    """Test X API connection with a simple search"""
    if not x_client:
        raise HTTPException(status_code=500, detail="X API not configured")

    try:
        # Simple test search - iterate through pages
        posts_found = []

        for page in x_client.posts.search_recent(
            query="from:elonmusk",
            max_results=10
        ):
            # Access data attribute from each page
            page_data = getattr(page, 'data', []) or []
            print(f"[Test] Page has {len(page_data)} posts")

            for post in page_data:
                # Handle both dict and object access
                post_id = post.get('id') if isinstance(post, dict) else post.id
                post_text = post.get('text') if isinstance(post, dict) else post.text

                posts_found.append({
                    'id': post_id,
                    'text': post_text[:100] + '...' if len(post_text) > 100 else post_text
                })

            # Only get first page for test
            break

        print(f"[Test] Total posts found: {len(posts_found)}")

        return {
            "status": "success",
            "posts_found": len(posts_found),
            "sample_posts": posts_found
        }

    except Exception as e:
        print(f"[Test] Error: {e}")
        return {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__
        }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "grok_api_configured": bool(GROK_API_KEY),
        "x_api_configured": bool(X_BEARER_TOKEN),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
