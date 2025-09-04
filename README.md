# adressenregister-fuzzy-search-service

A microservice which provides multiple ways to search for addresses in Belgium.

It integrates with:
- [Geolocation API](https://geo.api.vlaanderen.be/geolocation/v4/Location) for fuzzy search
- [Basisregisters API](https://basisregisters.vlaanderen.be/api/v2/adressen) for exact matches and details

## API

### Fuzzy Search
```
GET /search?query="Koningin Maria Hendrikaplein 70"
```

Returns addresses using fuzzy search from the geolocation API:
```json
{
  "adressen": [
    {
      "Municipality": "Gent",
      "Zipcode": "9000",
      "Thoroughfarename": "Koningin Maria Hendrikaplein",
      "Housenumber": "70",
      "FormattedAddress": "Koningin Maria Hendrikaplein 70, 9000 Gent, België",
      "Location": {
        "Lat_WGS84": 51.036745,
        "Lon_WGS84": 3.708143
      },
      "Country": "België"
    }
  ],
  "totaalAantal": 1
}
```

### Exact Match
```
GET /match?municipality=Gent&zipcode=9000&thoroughfarename=Koningin Maria Hendrikaplein&housenumber=70
```

Returns exact matches from the basisregisters API.

### Address Details  
```
GET /detail?uri=https://api.basisregisters.vlaanderen.be/v2/adressen/3706808
```

Returns detailed address information from a specific URI.

### Location-based Suggestions
```
GET /suggest-from-latlon?lat=51.036745&lon=3.708143&count=5
```

Returns address suggestions based on coordinates.

## Installation
To add the service to your stack, add the following snippet to docker-compose.yml:
```
adressenregister:
    image: lblod/adressenregister-fuzzy-search-service:the.version.you.need
```
