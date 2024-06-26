import { app, errorHandler } from 'mu';
import request from 'request';

const LOC_GEOPUNT_ENDPOINT = `https://geo.api.vlaanderen.be/geolocation/v4/Location`;
const BASISREGISTER_ADRESMATCH = `https://basisregisters.vlaanderen.be/api/v2/adressen`;
const DEFAULT_COUNTRY = 'België';

app.use(errorHandler);

app.get('/', (req, res) => res.send({ 'msg': `Welcome to adressenregister-fuzzy-search-service.` }));

app.get('/search', async (req, res) => {
  const query = req.query.query;

  if (!query) {
    res.status(400).send({ 'msg': `Please, include ?query=your address` });
    return;
  }

  const locations = await getLocations(query.replace(/^"(.*)"$/, '$1'));

  //mimick api of basisregister
  res.send({ 'adressen': locations, 'totaalAantal': locations.length });
});

app.get('/match', async (req, res) => {
  const municipality = req.query.municipality;
  const zipcode = req.query.zipcode;
  const thoroughfarename = req.query.thoroughfarename;
  const housenumber = req.query.housenumber;

  const addresses = (await getBasisregisterAdresMatch(municipality, zipcode, thoroughfarename, housenumber));
  res.send(addresses);
});

app.get('/detail', async (req, res) => {
  const uri = req.query.uri;
  if (!uri) {
    res.status(400).send({ 'msg': `Please, include ?uri=http://foo` });
    return;
  }

  let result = await getDetail(uri);
  if (!result) {
    res.status(404).send({ 'msg': `Details not found for ${uri}` });
    return;
  }
  res.send(result);
});

app.get('/suggest-from-latlon', async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;
  const count = req.query.count;

  const addresses = (await getAddressesFromLatLon(lat, lon, count));
  res.send(addresses);
});

async function getDetail(uri) {
  return processBasisregisterResponse(await getUrl(`${uri}`));
}

async function getLocations(fuzzyRes) {
  return processGeolocationResponse(await getUrl(`${LOC_GEOPUNT_ENDPOINT}?q=${encodeURIComponent(fuzzyRes)}&c=10&type=Housenumber`)); // We force the results to have at least a housenumber
};

// Note: BASISREGISTER_ADRESMATCH doesn't match if a param has accents in it.
// To be able to process all the addresses, we need to make the letters as simple as possible
async function getBasisregisterAdresMatch(municipality, zipcode, thoroughfarename, housenumber) {
  let queryParams = '';

  if (municipality)
    queryParams += `GemeenteNaam=${replaceAccents(municipality)}&`;

  if (zipcode)
    queryParams += `Postcode=${replaceAccents(zipcode)}&`;

  if (thoroughfarename)
    queryParams += `Straatnaam=${replaceAccents(thoroughfarename)}&`;

  if (housenumber)
    queryParams += `Huisnummer=${replaceAccents(housenumber)}&`;

  if (!queryParams) return [];

  const url = `${BASISREGISTER_ADRESMATCH}?${queryParams}`;

  return processBasisregisterResponse(await getUrl(url));
}

async function getAddressesFromLatLon(lat, lon, count) {
  return processGeolocationResponse(await getUrl(`${LOC_GEOPUNT_ENDPOINT}?latlon=${lat},${lon}&c=${count}`));
};

/**
 * Get call url
 */
async function getUrl(stringUrl, headers = {}) {
  const url = (new URL(stringUrl)).href;

  return new Promise((resolve, reject) => {
    let r = request({ url, headers });
    request(url, (error, response, body) => {
      if (error) {
        console.log(`Error occured by fetching url: ${url} `);
        console.log(`Status code: ${response.statusCode} `);
        console.log(`Error: ${error} `);
        reject(error);
      }
      resolve(body);
    });
  });

}

function processGeolocationResponse(response) {
  const results = tryJsonParse(response);
  if (!results) return [];
  // Add country to addresses. The API only returns addresses in Belgium.
  let addresses = results['LocationResult'].map(address => {
    address['Country'] = DEFAULT_COUNTRY;
    address['FormattedAddress'] = `${address['FormattedAddress']}, ${address['Country']}`;
    return address;
  });
  return addresses;
}

function processBasisregisterResponse(response) {
  const results = tryJsonParse(response);

  if (!results) {
    return [];
  }

  if (results['adressen'] && Array.isArray(results['adressen'])) {
    return results['adressen'].map(address => addDefaultCountryToBasisregisterAddress(address));
  } else {
    return addDefaultCountryToBasisregisterAddress(results);
  }
}

function addDefaultCountryToBasisregisterAddress(address) {
  let fullAddress = address.volledigAdres.geografischeNaam;
  if (fullAddress.taal === 'nl') {
    fullAddress.spelling = `${fullAddress.spelling}, ${DEFAULT_COUNTRY}`;
  }
  address['land'] = DEFAULT_COUNTRY;
  return address;
}



function tryJsonParse(str) {
  try {
    return JSON.parse(str);
  }
  catch (e) {
    return null;
  }
}

// From https://ricardometring.com/javascript-replace-special-characters
function replaceAccents(string) {
  return string.normalize('NFD').replace(/([\u0300-\u036f])/g, '');
}
