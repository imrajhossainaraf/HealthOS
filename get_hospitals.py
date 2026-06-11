import urllib.request
import urllib.parse
import json

overpass_url = 'http://overpass-api.de/api/interpreter'
overpass_query = """
[out:json];
area["name"~"Sonaimuri|Sonaimuri Upazila"]->.searchArea;
(
  node["amenity"="hospital"](area.searchArea);
  way["amenity"="hospital"](area.searchArea);
  relation["amenity"="hospital"](area.searchArea);
  node["amenity"="clinic"](area.searchArea);
  way["amenity"="clinic"](area.searchArea);
  relation["amenity"="clinic"](area.searchArea);
);
out center;
"""

req = urllib.request.Request(overpass_url, data=overpass_query.encode('utf-8'))
req.add_header('User-Agent', 'MyBot/1.0')
try:
    response = urllib.request.urlopen(req)
    data = json.loads(response.read().decode('utf-8'))
    for element in data.get('elements', []):
        tags = element.get('tags', {})
        lat = element.get('lat') or element.get('center', {}).get('lat')
        lon = element.get('lon') or element.get('center', {}).get('lon')
        name = tags.get('name', tags.get('name:en', 'Unknown'))
        print(f"Name: {name}")
        print(f"Amenity: {tags.get('amenity', 'Unknown')}")
        print(f"Lat: {lat}, Lon: {lon}")
        print(f"Tags: {tags}")
        print('---')
except Exception as e:
    print(f'Error: {e}')
