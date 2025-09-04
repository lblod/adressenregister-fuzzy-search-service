import { app, errorHandler } from 'mu';

const LOC_GEOPUNT_ENDPOINT = 'https://geo.api.vlaanderen.be/geolocation/v4/Location';
const BASISREGISTER_ADRESMATCH = 'https://basisregisters.vlaanderen.be/api/v2/adressen';
const DEFAULT_COUNTRY = 'België';

app.get('/', (req, res) => res.send({ 'msg': 'Welcome to adressenregister-fuzzy-search-service.' }));

app.get('/search', async (req, res, next) => {
  const query = req.query.query;

  if (!query) {
    return res.status(400).send({ 'msg': 'Please, include ?query=your address' });
  }

  try {
    const locations = await getLocations(query.replace(/^"(.*)"$/, '$1'));
    res.send({ 'adressen': locations, 'totaalAantal': locations.length });
  } catch (error) {
    next(error);
  }
});

app.get('/match', async (req, res, next) => {
  const { municipality, zipcode, thoroughfarename, housenumber } = req.query;

  try {
    const addresses = await getBasisregisterAdresMatch(municipality, zipcode, thoroughfarename, housenumber);
    res.send(addresses);
  } catch (error) {
    next(error);
  }
});

app.get('/detail', async (req, res, next) => {
  const { uri } = req.query;

  if (!uri) {
    return res.status(400).send({ 'msg': 'Please, include ?uri=http://foo' });
  }

  try {
    const result = await getDetail(uri);
    if (!result) {
      return res.status(404).send({ 'msg': `Details not found for ${uri}` });
    }
    res.send(result);
  } catch (error) {
    next(error);
  }
});

app.get('/suggest-from-latlon', async (req, res, next) => {
  const { lat, lon, count } = req.query;

  try {
    const addresses = await getAddressesFromLatLon(lat, lon, count);
    res.send(addresses);
  } catch (error) {
    next(error);
  }
});

app.use(errorHandler);

/**
 * Get address details from a specific URI
 * @param {string} uri - The URI to fetch details from
 * @returns {Promise<Object>} The processed address details
 */
async function getDetail(uri) {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return processBasisregisterResponse(data);
}

/**
 * Get address locations using fuzzy search
 * @param {string} fuzzyRes - The fuzzy search query string
 * @returns {Promise<Array>} Array of processed location results
 */
async function getLocations(fuzzyRes) {
  const url = `${LOC_GEOPUNT_ENDPOINT}?q=${encodeURIComponent(fuzzyRes)}&c=10&type=Housenumber`; // We force the results to have at least a housenumber
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return processGeolocationResponse(data);
}

/**
 * Get address matches from basisregister API
 * Note: BASISREGISTER_ADRESMATCH doesn't match if a param has accents in it.
 * To be able to process all the addresses, we need to make the letters as simple as possible
 * @param {string} municipality - Municipality name
 * @param {string} zipcode - Postal code
 * @param {string} thoroughfarename - Street name
 * @param {string} housenumber - House number
 * @returns {Promise<Array>} Array of processed address matches
 */
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

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return processBasisregisterResponse(data);
}

/**
 * Get addresses based on latitude and longitude coordinates
 * @param {string|number} lat - Latitude coordinate
 * @param {string|number} lon - Longitude coordinate
 * @param {string|number} count - Maximum number of results to return
 * @returns {Promise<Array>} Array of processed addresses
 */
async function getAddressesFromLatLon(lat, lon, count) {
  const url = `${LOC_GEOPUNT_ENDPOINT}?latlon=${lat},${lon}&c=${count}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return processGeolocationResponse(data);
}


/**
 * Process geolocation API response and add country information
 * @param {Object} data - The parsed JSON response object
 * @returns {Array} Array of processed addresses with country information
 */
function processGeolocationResponse(data) {
  if (!data || !data.LocationResult) return [];
  // Add country to addresses. The API only returns addresses in Belgium.
  const addresses = data.LocationResult.map(address => {
    address['Country'] = DEFAULT_COUNTRY;
    address['FormattedAddress'] = `${address['FormattedAddress']}, ${address['Country']}`;
    return address;
  });
  return addresses;
}

/**
 * Process basisregister API response and add country information
 * @param {Object} data - The parsed JSON response object
 * @returns {Array|Object} Processed address(es) with country information
 */
function processBasisregisterResponse(data) {
  if (!data) {
    return [];
  }

  if (data.adressen && Array.isArray(data.adressen)) {
    return data.adressen.map(address => addDefaultCountryToBasisregisterAddress(address));
  } else {
    return addDefaultCountryToBasisregisterAddress(data);
  }
}

/**
 * Add default country information to a basisregister address
 * @param {Object} address - The address object to modify
 * @returns {Object} The modified address with country information
 */
function addDefaultCountryToBasisregisterAddress(address) {
  const fullAddress = address.volledigAdres.geografischeNaam;
  if (fullAddress.taal === 'nl') {
    fullAddress.spelling = `${fullAddress.spelling}, ${DEFAULT_COUNTRY}`;
  }
  address['land'] = DEFAULT_COUNTRY;
  return address;
}

/**
 * Remove accents from string to normalize text for API calls
 * From https://ricardometring.com/javascript-replace-special-characters
 * @param {string} string - The string to normalize
 * @returns {string} String with accents removed
 */
function replaceAccents(string) {
  return string.normalize('NFD').replace(/([\u0300-\u036f])/g, '');
}
