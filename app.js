import { app, errorHandler} from 'mu';
import request from 'request';


const FUZZY_GEOPUNT_ENDPOINT = `https://loc.geopunt.be/v4/suggestion`;
const LOC_GEOPUNT_ENDPOINT = `https://loc.geopunt.be/v4/location`;
const BASISREGISTER_ADRESMATCH = `https://basisregisters.vlaanderen.be/api/v1/adressen`;

app.use(errorHandler);

app.get('/', ( req, res ) => res.send({ 'msg': `Welcome to adressenregister-fuzzy-search-service.` } ) );

app.get('/search', async (req, res) => {
  const query = req.query.query;

  if(!query){
    res.status(400).send({'msg': `Please, include ?query=your address`});
    return;
  }

  const fuzzyResults = await getFuzzySuggestions(query);

  const locationsFromFuzzyResults = await Promise.all(fuzzyResults.map((r) => getLocationFromFuzzyResult(r)));
  const uniqueLocations = mergeLocations(locationsFromFuzzyResults);
  //mimick api of basisregister
  res.send({'adressen': uniqueLocations, 'totaalAantal': uniqueLocations.length });
});

app.get('/match', async (req, res) => {
  const municipality = req.query.municipality;
  const zipcode = req.query.zipcode;
  const thoroughfarename = req.query.thoroughfarename;
  const housenumber = req.query.housenumber;

  // We take the first match arbitrary here, can be improved
  const address = (await getBasisregisterAdresMatch(municipality, zipcode, thoroughfarename, housenumber))[0];

  //mimick api of basisregister
  res.send(address);
});

app.get('/detail', async (req, res) => {
  const uri = req.query.uri;
  if(!uri){
    res.status(400).send({'msg': `Please, include ?uri=http://foo`});
    return;
  }

  let result = await getDetail(uri);
  if(!result){
    res.status(404).send({'msg': `Details not found for ${uri}`});
    return;
  }
  res.send(result);
});

async function getDetail(uri){
  const results = tryJsonParse(await getUrl(`${uri}`));
  if(!results) return null;
  return results;
};

async function getFuzzySuggestions(query){
  const results = tryJsonParse(await getUrl(`${FUZZY_GEOPUNT_ENDPOINT}?q=${query}`));
  if(!results) return [];
  return results['SuggestionResult'];
};

async function getLocationFromFuzzyResult(fuzzyRes){
  const results = tryJsonParse(await getUrl(`${LOC_GEOPUNT_ENDPOINT}?q=${fuzzyRes}&c=100`));
  if(!results) return [];
  return results['LocationResult'];
};

function mergeLocations(allLocations){
  let flatLocations = [];
  allLocations.forEach(locations => flatLocations = [ ...flatLocations, ...locations]);
  let uniqueLocations = [];
  flatLocations.forEach(location => {
    if(!uniqueLocations.find(l => location.ID == l.ID && location.LocationType == l.LocationType)){
      uniqueLocations.push(location);
    }
  });
  return uniqueLocations;
};

async function getBasisregisterAdresMatch(municipality, zipcode, thoroughfarename, housenumber){
  let queryParams = '';

  if(municipality)
    queryParams += `GemeenteNaam=${municipality}&`;

  if(zipcode)
    queryParams += `Postcode=${zipcode}&`;

  if(thoroughfarename)
    queryParams += `Straatnaam=${thoroughfarename}&`;

  if(housenumber)
    queryParams += `Huisnummer=${housenumber}&`;

  if(!queryParams) return [];

  const url = `${BASISREGISTER_ADRESMATCH}?${queryParams}`;

  const results = tryJsonParse(await getUrl(url));

  if(!results) return [];

  return results['adressen'];
}

/**
 * Get call url
 */
async function getUrl (url, headers = {}) {

  return new Promise((resolve, reject) => {
    let r = request({url, headers});
    request(url, (error, response, body) => {
      if(error){
        console.log(`Error occured by fetching url: ${url}`);
        console.log(`Status code: ${response.statysCode}`);
        console.log(`Error: ${error}`);
        reject(error);
      }
      resolve(body);
    });
  });

}

function tryJsonParse(str){
  try {
    return JSON.parse(str);
  }
  catch (e) {
    return null;
  }
}
