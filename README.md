# adressenregister-fuzzy-search-service

A microservice which eases fuzzy search on adressenregister.

It does so by matching the fuzzy search results of [http://loc.geopunt.be/v4/suggestion](http://loc.geopunt.be/v4/suggestion) to objects in [https://basisregisters.vlaanderen.be/api/v1/adressen](https://basisregisters.vlaanderen.be/api/v1/adressen)

## API
```
GET /search?query="Koningin Maria Hendrikaplein 70"
```

Should return:

```
{
    "adressen": [
        {
            "identificator": {
                "id": "https://data.vlaanderen.be/id/adres/3706808",
                "naamruimte": "https://data.vlaanderen.be/id/adres",
                "objectId": "3706808",
                "versieId": 14
            },
            "detail": "https://basisregisters.vlaanderen.be/api/v1/adressen/3706808",
            "huisnummer": "70",
            "busnummer": "",
            "volledigAdres": {
                "geografischeNaam": {
                    "spelling": "Koningin Maria Hendrikaplein 70, 9000 Gent",
                    "taal": "NL"
                }
            }
        }
    ],
    "totaalAantal": 1
}
```

## Installation
To add the service to your stack, add the following snippet to docker-compose.yml:
```
adressenregister:
    image: lblod/adressenregister-fuzzy-search-service:the.version.you.need
```
