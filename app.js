import { app, errorHandler} from 'mu';
import request from 'request';

const LOC_GEOPUNT_ENDPOINT = `https://loc.geopunt.be/v4/Location`;
const BASISREGISTER_ADRESMATCH = `https://basisregisters.vlaanderen.be/api/v1/adressen`;

app.use(errorHandler);

app.get('/', ( req, res ) => res.send({ 'msg': `Welcome to adressenregister-fuzzy-search-service.` } ) );

app.get('/search', async (req, res) => {
  const query = req.query.query;

  if(!query){
    res.status(400).send({'msg': `Please, include ?query=your address`});
    return;
  }

  const locations = await getLocations(query);

  //mimick api of basisregister
  res.send({'adressen': locations, 'totaalAantal': locations.length });
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

app.get('/suggest-from-latlon', async (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;
  const count = req.query.count;

  const addresses = (await getAddressesFromLatLon(lat, lon, count));
  res.send(addresses);
});

async function getDetail(uri){
  const results = tryJsonParse(await getUrl(`${uri}`));
  if(!results) return null;
  return results;
};

async function getLocations(fuzzyRes){
  const results = tryJsonParse(await getUrl(`${LOC_GEOPUNT_ENDPOINT}?q=${fuzzyRes}&c=10&type=Housenumber`)); // We force the results to have at least a housenumber
  if(!results) return [];
  return results['LocationResult'];
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

async function getAddressesFromLatLon(lat, lon, count){
  const results = tryJsonParse(await getUrl(`${LOC_GEOPUNT_ENDPOINT}?latlon=${lat},${lon}&c=${count}`));
  if(!results) return [];
  return results['LocationResult'];
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
