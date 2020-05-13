# FFPass NPM module

This module will allow you to control a FordPass Enabled vehicle from your javascript code. 

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