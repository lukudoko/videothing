# scraper.py

import os
import re
from urllib.parse import urljoin, unquote
import requests
from bs4 import BeautifulSoup

suff_list = ['.avi', '.mpg', '.mkv', '.flv', '.mp4']

def sanitize_filename(filename, max_length=255):
    filename = unquote(filename)
    filename = re.sub(r'_ImSM8O$', '', filename)
    filename = re.sub(r'[\\/*?:"<>|]', '', filename)
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext)] + ext
    return filename

def scrape_video_links(page_url):
    try:
        response = requests.get(page_url)
        response.raise_for_status()
    except Exception as e:
        return {"error": str(e)}

    soup = BeautifulSoup(response.text, 'html.parser')
    video_links = [
        {
            "url": urljoin(page_url, a['href']),
            "filename": sanitize_filename(a['href'].split('/')[-1])
        }
        for a in soup.find_all('a')
        if a.get('href', '').endswith(tuple(suff_list))
    ]
    return {"videos": video_links}
