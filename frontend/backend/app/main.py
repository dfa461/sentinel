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
    Search X posts for candidates matching a role description.
    Uses X API (via xdk) + xAI for relevance filtering.
    """

    if not x_client:
        raise HTTPException(status_code=500, detail="X API not configured. Set X_BEARER_TOKEN environment variable.")

    # Hardcoded list of X handles to search from (tech influencers, developers)
    TARGET_HANDLES = [
        "frankg0485"
    ]

    try:
        all_posts = []

        # Search posts from each target handle
        for handle in TARGET_HANDLES:
            try:
                # Build query: posts from this user (broaden search, filter for github later)
                query = f"from:{handle}"

                # Search recent posts (last 7 days) - works on free tier
                for page in x_client.posts.search_recent(
                    query=query,
                    max_results=10,  # Per page
                    tweet_fields=["created_at", "text", "author_id"],
                    expansions=["author_id"],
                    user_fields=["username"]
                ):
                    # Access data attribute from each page
                    page_data = getattr(page, 'data', []) or []
                    print(f"[X Search] @{handle}: Page has {len(page_data)} posts")

                    posts_with_github = 0
                    for post in page_data:
                        # Handle both dict and object access
                        post_id = post.get('id') if isinstance(post, dict) else post.id
                        post_text = post.get('text') if isinstance(post, dict) else post.text
                        created_at = post.get('created_at') if isinstance(post, dict) else getattr(post, 'created_at', None)

                        # Find all URLs in the post (including t.co)
                        all_urls = re.findall(r'https?://[^\s\)]+', post_text)
                        github_links = []

                        for url in all_urls:
                            # If it's already a GitHub link, use it
                            if 'github.com' in url:
                                github_links.append(url)
                            # If it's a t.co link, expand it to see if it points to GitHub
                            elif 't.co' in url:
                                expanded_url = await expand_short_url(url)
                                print(f"[URL Expand] {url} -> {expanded_url}")
                                if 'github.com' in expanded_url:
                                    github_links.append(expanded_url)

                        if github_links:
                            posts_with_github += 1
                            all_posts.append({
                                'username': handle,
                                'post_text': post_text,
                                'post_id': post_id,
                                'github_links': github_links,
                                'created_at': created_at
                            })

                    # Only get first page per user
                    break

                print(f"[X Search] @{handle}: {posts_with_github} posts with GitHub links")

            except Exception as e:
                print(f"[X Search] Error searching @{handle}: {e}")
                continue

        print(f"[X Search] Total posts with GitHub links: {len(all_posts)}")

        # Use Grok to filter and rank by relevance to role description
        if all_posts and GROK_API_KEY:
            try:
                posts_summary = "\n\n".join([
                    f"Post {i+1} - @{p['username']}:\n{p['post_text']}\nGitHub: {', '.join(p['github_links'])}"
                    for i, p in enumerate(all_posts[:20])  # Send top 20 to Grok for filtering
                ])

                filtering_prompt = f"""You are analyzing X posts to find candidates for this role:
{request.role_description}

Here are posts from tech professionals that mention GitHub:

{posts_summary}

Rate each post's relevance to the role on a scale of 0-10. Return ONLY a JSON array with post numbers and scores:
[
  {{"post": 1, "score": 8.5, "reason": "Strong PyTorch experience shown"}},
  {{"post": 2, "score": 5.0, "reason": "Some ML background"}},
  ...
]

Include only posts with score >= 6.0. Limit to top {request.max_results} posts."""

                grok_response = await call_grok_api(
                    [{"role": "user", "content": filtering_prompt}],
                    temperature=0.3
                )

                # Parse Grok's relevance scores
                json_match = re.search(r'\[.*\]', grok_response, re.DOTALL)
                if json_match:
                    rankings = json.loads(json_match.group(0))

                    # Map back to original posts and sort by score
                    ranked_posts = []
                    for ranking in rankings:
                        post_idx = ranking['post'] - 1  # Convert to 0-indexed
                        if 0 <= post_idx < len(all_posts):
                            post = all_posts[post_idx]
                            post['relevance_score'] = ranking['score']
                            ranked_posts.append(post)

                    # Sort by relevance score
                    ranked_posts.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
                    all_posts = ranked_posts[:request.max_results]

            except Exception as e:
                print(f"[X Search] Error filtering with Grok: {e}")
                # Fall back to returning all posts without relevance scores
                all_posts = all_posts[:request.max_results]

        # Format results
        results = []
        for post in all_posts[:request.max_results]:
            results.append(CandidatePost(
                username=post['username'],
                post_text=post['post_text'],
                post_url=f"https://x.com/{post['username']}/status/{post['post_id']}",
                github_links=list(set(post['github_links'])),
                relevance_score=post.get('relevance_score')
            ))

        return {
            "role_description": request.role_description,
            "candidates_found": len(results),
            "candidates": results,
            "searched_handles": TARGET_HANDLES,
            "total_posts_found": len(all_posts)
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
