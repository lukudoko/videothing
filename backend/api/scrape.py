# backend/api/scrape.py
from fastapi import APIRouter, HTTPException
import logging

# Import models from the new core location
from backend.core.models import ScrapeRequest
# scraper.py is in the 'backend' parent directory relative to 'api'
from backend.scraper import scrape_video_links

router = APIRouter()
# Logging config here just in case, but main.py sets up global logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

@router.post("/scrape")
def scrape(req: ScrapeRequest):
    logging.info(f"Received scrape request for URL: {req.url}")
    result = scrape_video_links(req.url)
    if "error" in result:
        logging.error(f"Scraping failed for {req.url}: {result['error']}")
        raise HTTPException(status_code=400, detail=result["error"])
    logging.info(f"Scraping successful for {req.url}")
    return result
