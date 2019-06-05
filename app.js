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
  const addresses = await Promise.all(uniqueLocations.map( l => getBasisregisterAdresMatch(l)));
  const uniqueAddresses = await mergeAddresses(addresses);

  //mimick api of basisregister
  res.send({'adressen': uniqueAddresses, 'totaalAantal': uniqueAddresses.length });
});

app.get('/detail', async (req, res) => {
  const url = req.query.url;
  if(!url){
    res.status(400).send({'msg': `Please, include ?url=https://foo/detail`});
    return;
  }

  let result = await getDetail(url);
  if(!result){
    res.status(404).send({'msg': `Details not found for ${url}`});
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

async function getBasisregisterAdresMatch(geoPuntLocation){
  let queryParams = '';

  if(geoPuntLocation.Municipality)
    queryParams += `GemeenteNaam=${geoPuntLocation.Municipality}&`;

  if(geoPuntLocation.Zipcode)
    queryParams += `Postcode=${geoPuntLocation.Zipcode}&`;

  if(geoPuntLocation.Thoroughfarename)
    queryParams += `Straatnaam=${geoPuntLocation.Thoroughfarename}&`;

  if(geoPuntLocation.Housenumber)
    queryParams += `Huisnummer=${geoPuntLocation.Housenumber}&`;

  if(!queryParams) return [];

  const url = `${BASISREGISTER_ADRESMATCH}?${queryParams}`;

  const results = tryJsonParse(await getUrl(url));

  if(!results) return [];

  return results['adressen'];
}

function mergeAddresses(allAddresses){

  let flatAddresses = [];
  allAddresses.forEach(addresses => flatAddresses = [ ...flatAddresses, ...addresses]);
  let uniqueAddresses = [];
  flatAddresses.forEach(address => {
    if(!uniqueAddresses.find(a => a.identificator.id == address.identificator.id)){
      uniqueAddresses.push(address);
    }
  });
  return uniqueAddresses;

};

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
