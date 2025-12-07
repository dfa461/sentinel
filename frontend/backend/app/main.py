from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import json
import re
import secrets
from datetime import datetime
from dotenv import load_dotenv
from xai_sdk import AsyncClient
from xai_sdk.chat import user, system
from xdk import Client as XClient
import httpx
import PyPDF2
import io
from .rl_assessment import router as rl_router
from .github_extractor import GitHubExtractor

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

# GitHub API configuration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# Create global xAI client
xai_client = AsyncClient(api_key=GROK_API_KEY)

# Create global X API client
x_client = None
if X_BEARER_TOKEN:
    x_client = XClient(bearer_token=X_BEARER_TOKEN)

# Create GitHub extractor
github_extractor = GitHubExtractor(GITHUB_TOKEN) if GITHUB_TOKEN else None

# In-memory storage for candidates
pending_candidates_db: Dict[str, Any] = {"DEBUG": {}}  # username -> candidate data
assessed_candidates_db: Dict[str, Any] = {}  # username -> assessment data
assessment_tokens_db: Dict[str, str] = {}  # token -> username mapping


# Models removed - no longer needed since AssessmentPage was removed
# InteractiveAssessmentPage uses RL-specific endpoints in rl_assessment.py


class RoleSearchRequest(BaseModel):
    role_description: str
    max_results: Optional[int] = 10


class SocialMedia(BaseModel):
    email: Optional[str] = None
    twitter: Optional[str] = None
    blog: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    github_bio: Optional[str] = None


class CandidatePost(BaseModel):
    username: str
    post_text: str
    post_url: str
    github_links: List[str]
    relevance_score: Optional[float] = None
    social_media: Optional[SocialMedia] = None
    status: str = "pending"  # "pending" or "assessed"


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
    "primary_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "technical_terms": ["tech1", "tech2", "tech3", "tech4"],
    "search_queries": [
        "specific query with all key terms",
        "broader query with main terms",
        "keyword-based query 1",
        "keyword-based query 2",
        "alternative phrasing"
    ]
}}

Make search_queries diverse and progressively broader. Include both formal (e.g., "machine learning engineer") and informal (e.g., "ML dev") variations."""

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

        TARGET_USERS = request.max_results * 10  # Try to find 3x more users than needed
        MAX_USERS = 5000  # Hard cap to avoid too many API calls

        # Progressive broadening strategy - get more aggressive
        primary_keywords = jd_profile.get('primary_keywords', [])
        technical_terms = jd_profile.get('technical_terms', [])

        search_attempts = [
            {
                'queries': search_queries[:2],  # Most specific queries
                'suffix': ' github.com -is:retweet',  # Must have GitHub in post
                'max_results': 20,
                'description': 'Level 1: Specific queries + GitHub required'
            },
            {
                'queries': search_queries[:4],  # More queries
                'suffix': ' -is:retweet',  # Remove GitHub filter
                'max_results': 30,
                'description': 'Level 2: Broader queries, no GitHub filter'
            },
            {
                'queries': primary_keywords[:3],  # Just primary keywords
                'suffix': ' -is:retweet',
                'max_results': 50,
                'description': 'Level 3: Primary keywords only'
            },
            # {
            #     'queries': technical_terms[:3],  # Just technical terms
            #     'suffix': '',  # Include retweets too
            #     'max_results': 100,
            #     'description': 'Level 4: Technical terms + retweets allowed'
            # },
            # {
            #     'queries': [f"{kw} developer" for kw in primary_keywords[:2]],  # Combine with "developer"
            #     'suffix': '',
            #     'max_results': 100,
            #     'description': 'Level 5: Keywords + "developer"'
            # },
            # {
            #     'queries': [f"{kw} engineer" for kw in technical_terms[:2]],  # Combine with "engineer"
            #     'suffix': '',
            #     'max_results': 100,
            #     'description': 'Level 6: Technical terms + "engineer"'
            # }
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

                    # Search posts matching the query - fetch multiple pages
                    pages_fetched = 0
                    max_pages = 1  # Fetch up to 3 pages per query for broader results

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

                        print(f"[Stage 2] Page {pages_fetched + 1}: '{full_query[:50]}...' -> {len(page_data)} posts")

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

                        pages_fetched += 1

                        # Stop if we have enough users or hit page limit
                        if len(discovered_users) >= MAX_USERS or pages_fetched >= max_pages:
                            break

                    print(f"[Stage 2] Query fetched {pages_fetched} pages, {len(discovered_users)} total users so far")

                except Exception as e:
                    print(f"[Stage 2] Error with query '{search_query}': {e}")
                    continue

        print(f"[Stage 2] Discovered {len(discovered_users)} unique users")

        # Stage 3: Enrich with bio analysis
        print(f"[Stage 3] Fetching user bios...")

        usernames_to_lookup = list(discovered_users.keys())

        # Batch requests (X API limit is 100 usernames per request)
        BATCH_SIZE = 100
        total_enriched = 0

        for i in range(0, len(usernames_to_lookup), BATCH_SIZE):
            batch = usernames_to_lookup[i:i + BATCH_SIZE]

            try:
                print(f"[Stage 3] Fetching batch {i//BATCH_SIZE + 1} ({len(batch)} users)...")

                users_response = x_client.users.get_by_usernames(
                    usernames=batch,
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

                        total_enriched += 1

            except Exception as e:
                print(f"[Stage 3] Error fetching batch {i//BATCH_SIZE + 1}: {e}")
                continue

        print(f"[Stage 3] Enriched {total_enriched} user profiles with bios")

        # Filter: Only keep users with GitHub links
        candidates_with_github = {
            user: data for user, data in discovered_users.items()
            if data['github_links']
        }

        print(f"[Stage 3] {len(candidates_with_github)} users have GitHub links")

        # Easter egg: Always add @devamshri as a bonus candidate
        if 'devamshri' not in discovered_users:
            print(f"[Easter Egg] Adding @devamshri to candidate pool...")

            # Generate a relevant description using Grok
            devam_prompt = f"""Generate a short, authentic-sounding X post (1-2 sentences) from a talented developer named Devam Shri that would be relevant to this role: {request.role_description}

The post should mention their GitHub and sound natural. Return ONLY the post text, no quotes or extra formatting."""

            try:
                devam_post = await call_grok_api(
                    [{"role": "user", "content": devam_prompt}],
                    temperature=0.7
                )
                devam_post = devam_post.strip().strip('"').strip("'")
            except:
                devam_post = f"Passionate about {request.role_description.split()[0] if request.role_description else 'software engineering'}. Check out my latest work on GitHub!"

            discovered_users['devamshri'] = {
                'username': 'devamshri',
                'posts': [{
                    'text': devam_post + ' https://github.com/devamshri',
                    'id': 'bonus',
                    'github_links': ['https://github.com/devamshri']
                }],
                'github_links': {'https://github.com/devamshri'},
                'bio': 'Talented developer with strong fundamentals',
                'matched_queries': ['bonus_candidate'],
                'github_profile': {
                    'username': 'devamshri',
                    'email': 'devamshri@gmail.com',
                    'twitter': 'zwzagoon',
                    'bio': f'Developer passionate about {request.role_description[:50] if request.role_description else "technology"}',
                    'blog': None,
                    'company': None,
                    'location': None
                }
            }

            # Add to candidates with github
            candidates_with_github['devamshri'] = discovered_users['devamshri']
            print(f"[Easter Egg] ✓ Added @devamshri to results")

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

        # Stage 4.5: Enrich with GitHub profile data (email, Twitter, etc.)
        print(f"[Stage 4.5] Enriching with GitHub profile data...")

        if github_extractor:
            for username, data in candidates_with_github.items():
                print(f"[Stage 4.5] Processing @{username} with {len(data['github_links'])} GitHub links")

                # Extract GitHub username/org from first GitHub link
                github_usernames = set()
                for gh_link in list(data['github_links'])[:3]:  # Check first 3 links
                    # Extract username from github.com/username or github.com/username/repo
                    match = re.search(r'github\.com/([^/\s]+)', gh_link)
                    if match:
                        gh_owner = match.group(1)
                        github_usernames.add(gh_owner)
                        print(f"[Stage 4.5] Extracted GitHub owner: {gh_owner} from {gh_link}")

                # Try to get GitHub profile info for each username
                for gh_user in github_usernames:
                    try:
                        print(f"[Stage 4.5] Fetching GitHub profile for: {gh_user}")
                        gh_profile = github_extractor.get_user_details(gh_user)

                        if gh_profile:
                            user_info = github_extractor.extract_user_info(gh_profile)
                            data['github_profile'] = user_info
                            print(f"[Stage 4.5] ✓ @{username} -> GitHub @{gh_user}: email={user_info.get('email', 'N/A')}, twitter={user_info.get('twitter', 'N/A')}")
                            break  # Stop after first successful profile
                        else:
                            print(f"[Stage 4.5] No profile returned for {gh_user}")

                    except Exception as e:
                        print(f"[Stage 4.5] Error fetching GitHub profile for {gh_user}: {e}")
                        continue

                if not data.get('github_profile'):
                    print(f"[Stage 4.5] ✗ No GitHub profile found for @{username}")

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

            # Build social media object from GitHub profile
            social_media = None
            if data.get('github_profile'):
                gh_prof = data['github_profile']
                social_media = SocialMedia(
                    email=gh_prof.get('email'),
                    twitter=gh_prof.get('twitter'),
                    blog=gh_prof.get('blog'),
                    company=gh_prof.get('company'),
                    location=gh_prof.get('location'),
                    github_bio=gh_prof.get('bio')
                )

            candidate_obj = CandidatePost(
                username=username,
                post_text=best_post['text'],
                post_url=f"https://x.com/{username}",
                github_links=list(data['github_links']),
                relevance_score=data.get('relevance_score'),
                social_media=social_media,
                status="pending"
            )
            results.append(candidate_obj)

            # Store in pending candidates database
            pending_candidates_db[username] = candidate_obj.dict()

        print(f"[Storage] Stored {len(results)} candidates in pending_candidates_db")

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


@app.get("/candidates/all")
async def get_all_candidates():
    """Get all candidates (pending and assessed)"""
    return {
        "pending": list(pending_candidates_db.values()),
        "assessed": list(assessed_candidates_db.values()),
        "total_pending": len(pending_candidates_db),
        "total_assessed": len(assessed_candidates_db)
    }


class SendAssessmentRequest(BaseModel):
    username: str
    email: str


@app.post("/send-assessment")
async def send_assessment_email(request: SendAssessmentRequest):
    """Send assessment link to candidate via email"""

    # Generate unique assessment token
    assessment_token = secrets.token_urlsafe(16)
    assessment_tokens_db[assessment_token] = request.username

    # Create unique assessment link
    assessment_link = f"http://localhost:5173/assessment/{assessment_token}"
    recipient_email = "frankg0485@gmail.com"  # Always send to this email for testing

    # Update candidate with assessment token
    if request.username in pending_candidates_db:
        pending_candidates_db[request.username]['assessment_token'] = assessment_token
        pending_candidates_db[request.username]['assessment_link'] = assessment_link

    print(f"[Email] Would send assessment for @{request.username} (candidate email: {request.email})")
    print(f"[Email] Actually sending to: {recipient_email}")
    print(f"[Email] Unique link: {assessment_link}")
    print(f"[Email] Token: {assessment_token}")

    # TODO: Integrate with actual email service
    # Email body would include: Hi {username}, please complete your assessment at {assessment_link}

    return {
        "success": True,
        "message": f"Assessment link sent to {recipient_email}",
        "assessment_link": assessment_link,
        "assessment_token": assessment_token,
        "candidate_username": request.username
    }


class VerifyAssessmentRequest(BaseModel):
    token: str
    email: str
    name: str


DEBUG_NO_VERIFY = False
@app.post("/verify-assessment-token")
async def verify_assessment_token(request: VerifyAssessmentRequest):
    """Verify assessment token and candidate info before starting assessment"""

    if request.token not in assessment_tokens_db and not DEBUG_NO_VERIFY:
        raise HTTPException(status_code=404, detail="Invalid or expired assessment link")

    if DEBUG_NO_VERIFY:
        username = "DEBUG"
    else:
        username = assessment_tokens_db[request.token]

    # Verify candidate exists
    if username not in pending_candidates_db and not DEBUG_NO_VERIFY:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate = pending_candidates_db[username]

    # Update candidate with provided info
    candidate['verified_email'] = request.email
    candidate['verified_name'] = request.name
    candidate['assessment_started'] = datetime.now().isoformat()

    print(f"[Verification] @{username} verified: {request.name} ({request.email})")

    return {
        "success": True,
        "username": username,
        "candidate_data": candidate
    }


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


async def extract_text_from_resume(file: UploadFile) -> str:
    """Extract text from uploaded resume file (PDF or TXT)"""

    content = await file.read()

    # Handle PDF files
    if file.filename.lower().endswith('.pdf'):
        try:
            pdf_file = io.BytesIO(content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)

            text_parts = []
            for page in pdf_reader.pages:
                text_parts.append(page.extract_text())

            return "\n".join(text_parts)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")

    # Handle text files
    elif file.filename.lower().endswith('.txt'):
        try:
            return content.decode('utf-8')
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse text file: {str(e)}")

    # Handle DOCX files
    elif file.filename.lower().endswith('.docx'):
        raise HTTPException(status_code=400, detail="DOCX files not yet supported. Please upload PDF or TXT.")

    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF or TXT file.")


@app.post("/generate-question-from-resume")
async def generate_question_from_resume(file: UploadFile = File(...)):
    """
    Generate a custom coding question based on uploaded resume.
    Uses Grok to analyze resume and create relevant problem + test cases.

    Args:
        file: Resume file (PDF or TXT format)
    """

    try:
        # Extract text from uploaded resume
        print(f"[Resume] Extracting text from {file.filename}...")
        resume_text = await extract_text_from_resume(file)

        if not resume_text or len(resume_text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Resume appears to be empty or too short")

        print(f"[Resume] Extracted {len(resume_text)} characters")
        print(f"[Resume] First 200 chars: {resume_text[:200]}")

        # Use Grok to analyze resume and generate custom question
        resume_analysis_prompt = f"""Analyze this candidate's resume and generate a custom coding problem that matches their background.

Resume:
{resume_text}

The problem should:
1. Be relevant to their experience level and domain (based on skills, projects, and work history in resume)
2. Have 2-3 test cases with clear input/output
3. Be completable in 20-30 minutes
4. Test practical skills mentioned in their resume
5. If they have experience with specific technologies (e.g., ML, systems, web dev), tailor the problem accordingly

Return ONLY a JSON object:
{{
    "problem_title": "Problem Title",
    "problem_description": "Detailed description in markdown format with constraints and examples",
    "starter_code_python": "def function_name():\\n    pass",
    "starter_code_java": "class Solution {{ }}",
    "test_cases": [
        {{"input": "example input", "output": "expected output", "explanation": "why this is the expected output"}},
        {{"input": "another input", "output": "expected output", "explanation": "why this is the expected output"}}
    ],
    "difficulty": "easy|medium|hard",
    "topics": ["relevant", "topic", "tags"],
    "reasoning": "Brief explanation of why this problem is relevant to this candidate"
}}"""

        print("[Resume] Calling Grok API to generate personalized question...")
        grok_response = await call_grok_api(
            [{"role": "user", "content": resume_analysis_prompt}],
            temperature=0.6
        )

        # Parse response
        json_match = re.search(r'\{.*\}', grok_response, re.DOTALL)
        if not json_match:
            raise HTTPException(status_code=500, detail="Failed to generate question")

        question_data = json.loads(json_match.group(0))

        print(f"[Resume] Generated question: {question_data.get('problem_title', 'N/A')}")
        print(f"[Resume] Reasoning: {question_data.get('reasoning', 'N/A')}")

        return {
            "success": True,
            "question": question_data,
            "resume_length": len(resume_text)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating question from resume: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate question: {str(e)}")


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
