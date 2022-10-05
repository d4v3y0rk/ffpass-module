# FFPass NPM module
[![npm](https://img.shields.io/npm/v/ffpass)](https://www.npmjs.com/package/ffpass)
[![build](https://github.com/d4v3y0rk/ffpass-module/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/d4v3y0rk/ffpass-module/actions/workflows/npm-publish.yml)

This module will allow you to control a FordPass Enabled vehicle from your javascript code.
It requires a node version >=14.


## Usage 

`npm install ffpass --save`

```javascript
const fordApi = require('ffpass')
const car = new fordApi.vehicle(process.env.FORD_USERNAME, process.env.FORD_PASSWORD, process.env.VIN)

async function main() {
    await car.auth()

    // to view current vehicle information including location
    var vehicleData = await car.status()
    console.log(JSON.stringify(vehicleData))

}
main()
```

## More Examples

A fully functional implementation of the usage of this module can be found here: [ffpass](https://github.com/d4v3y0rk/ffpass)