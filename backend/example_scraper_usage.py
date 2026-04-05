#!/usr/bin/env python
"""
Quick reference script showing how to install and manage scrapers
Run from backend directory: python example_scraper_usage.py
"""

import asyncio
import httpx
import json

API_BASE = "http://127.0.0.1:8000"


async def main():
    print("=== ManhwaVault Scraper API Examples ===\n")
    
    # Example 1: List all installed scrapers
    print("1. Listing all installed scrapers...")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_BASE}/extensions")
        scrapers = response.json()
        print(f"Found {len(scrapers)} scrapers:\n")
        for source_id, info in scrapers.items():
            print(f"  • {info['name']} ({source_id}) v{info['version']}")
    
    print("\n" + "="*50 + "\n")
    
    # Example 2: Search with specific scraper
    print("2. Searching for 'solo leveling' on Asura Scans...")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{API_BASE}/search/asura",
            json={"query": "solo leveling", "page": 1}
        )
        data = response.json()
        if data.get("results"):
            first_result = data["results"][0]
            print(f"Found: {first_result['title']}")
            print(f"Author: {first_result['author']}")
            print(f"Rating: {first_result['rating']}")
            print(f"URL: {first_result['url']}")
        else:
            print("No results found")
    
    print("\n" + "="*50 + "\n")
    
    # Example 3: Search multiple sources in parallel
    print("3. Parallel search across all sources...")
    async with httpx.AsyncClient() as client:
        tasks = []
        for source_id in ["asura", "flame", "reaper"]:
            task = client.post(
                f"{API_BASE}/search/{source_id}",
                json={"query": "tower of god", "page": 1}
            )
            tasks.append((source_id, task))
        
        for source_id, task in tasks:
            try:
                response = await task
                data = response.json()
                result_count = len(data.get("results", []))
                print(f"  {source_id}: {result_count} results")
            except Exception as e:
                print(f"  {source_id}: Error - {e}")
    
    print("\n" + "="*50 + "\n")
    
    # Example 4: Check for scraper updates
    print("4. Checking for extension updates...")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{API_BASE}/extensions/check-updates")
        updates = response.json()
        if updates:
            for ext_name, update_info in updates.items():
                print(f"  Update available for {ext_name}")
                print(f"    Local: {update_info['local']}")
                print(f"    Remote: {update_info['remote']}")
        else:
            print("  All extensions are up to date!")
    
    print("\n" + "="*50 + "\n")
    print("Examples complete! Try these requests manually:")
    print(f"  curl http://localhost:8000/extensions")
    print(f"  curl -X POST http://localhost:8000/search/asura \\")
    print(f"    -H 'Content-Type: application/json' \\")
    print(f"    -d '{{\"query\": \"solo leveling\", \"page\": 1}}'")


if __name__ == "__main__":
    asyncio.run(main())
