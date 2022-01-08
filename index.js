const request = require('axios')
const qs = require('querystring')

// https://github.com/axios/axios/issues/41#issuecomment-484546457
// By default, axios throws errors for http request.status < 200 || request.status >= 300
// This makes sure that it does not treat said status codes as errors = rejects the promise
request.defaults.validateStatus = function () { return true; };

const { fordHeaders, iamHeaders} = require('./fordHeaders')

const fordAPIUrl = 'https://usapi.cv.ford.com'
const authUrl = 'https://sso.ci.ford.com'
const tokenUrl = "https://api.mps.ford.com"

class vehicle {
    constructor(username, password, vin) {
        this.username = username,
        this.password = password,
        this.vin = vin,
        this.token = "",
        this.outdatedAfterSeconds = 5 * 60,
        this.maxRefreshTrials = 20
    }

    auth() {
        return new Promise(async (resolve, reject) => {
            var requestData = new Map([
                ['client_id', '9fb503e0-715b-47e8-adfd-ad4b7770f73b'],
                ['grant_type', 'password'],
                ['username', this.username],
                ['password', this.password]
            ])
            var options = {
                method: 'POST',
                baseURL: authUrl,
                url: '/v1.0/endpoint/default/token',
                headers: Object.fromEntries(iamHeaders),
                data: qs.stringify(Object.fromEntries(requestData))
            }

            try {
                var result = await request(options)
            } catch (err)  {
                console.log(err)
                reject(err.result.status)
            }

            if (result.status == 200) {
                var tokenOptions = {
                    method: 'PUT',
                    baseURL: tokenUrl,
                    url: '/api/oauth2/v1/token',
                    headers: Object.fromEntries(fordHeaders),
                    data: { code: result.data.access_token }
                }
                console.log(tokenOptions)
                try {
                    var tokenResult = await request(tokenOptions)
                    console.log(tokenResult.data)
                } catch (err)  {
                    console.log(err)
                    reject(err.result.status)
                }
                this.token = tokenResult.data.access_token
                resolve(tokenResult.data.access_token)
            } else {
                console.log(result)
                reject(result.status)
            }
        })
    }
    
    status() {
        return new Promise(async (resolve, reject) => {
            fordHeaders.set('auth-token', this.token)
            var options = {
                baseURL: fordAPIUrl,
                url: `/api/vehicles/v4/${this.vin}/status`,
                headers: Object.fromEntries(fordHeaders),
                params: {
                    "lrdt": "01-01-1970 00:00:00"
                }
            }

            try {
                var result = await request(options)
            } catch (err) {
                console.log(err)
                return reject(err.result.status)
            }

            if (result.status == 200) {
                // Check if the last update timestamp is too old
                // The lastRefresh timestamp is given in UTC. In order to parse the unix time correctly
                // We must add a "Z" so that it gets parsed as UTC
                var vehicleStatus = result.data.vehiclestatus
                var lastUpdate = Date.parse(vehicleStatus.lastRefresh + "Z")
                var dateNow = Date.now()
                var diffInSeconds = (dateNow - lastUpdate) / 1000

                if (diffInSeconds > this.outdatedAfterSeconds) {
                    console.log("Updating status!")
                    vehicleStatus = await this.requestStatusRefreshSync()
                }

                return resolve(vehicleStatus)
            } else {
                return reject(result.status)
            }
        })
    }
    
    issueCommand(command) {
        return new Promise(async (resolve, reject) => {
            fordHeaders.set('auth-token', this.token)
            var method = ""
            var url = ""
            if (command == 'start') {
                method = 'PUT'
                url = `/api/vehicles/v2/${this.vin}/engine/start`
            } else if (command == 'stop') {
                method = 'DELETE'
                url = `/api/vehicles/v2/${this.vin}/engine/start`
            } else if (command == 'lock') {
                method = 'PUT'
                url = `/api/vehicles/v2/${this.vin}/doors/lock`
            } else if (command == 'unlock') {
                method = 'DELETE'
                url = `/api/vehicles/v2/${this.vin}/doors/lock`
            } else {
                return reject('No command specified for issueCommand!')
            }
            var options = {
                method: method,
                baseURL: fordAPIUrl,
                url: url,
                headers: Object.fromEntries(fordHeaders),
            }

            try {
                var result = await request(options)
            } catch (err) {
                console.log(err)
                return reject(err.result.status)
            }

            if (result.status == 200) {
                return resolve(result.data)
            } else {
                return reject(result.status)
            }
        })
    }
    
    commandStatus(command, commandId) {
        return new Promise(async (resolve, reject) => {
            var url = ""
            if (command == 'start' || command == 'stop') {
                url = `/api/vehicles/v2/${this.vin}/engine/start/${commandId}`
            } else if (command == 'lock' || command == 'unlock') {
                url = `/api/vehicles/v2/${this.vin}/doors/lock/${commandId}`
            } else {
                return reject('no command specified for commandStatus')
            }
            fordHeaders.set('auth-token', this.token)
            var options = {
                baseURL: fordAPIUrl,
                url: url,
                headers: Object.fromEntries(fordHeaders),
            }

            try {
                var result = await request(options)
            } catch (err) {
                console.log(err)
                return reject(err.result.status)
            }

            if (result.status == 200) {
                return resolve(result.data.status)
            } else {
                return reject(result.status)
            }
        })
    }

    /**
     * Requests the Ford API to contact the vehicle for updated status data
     * Promise only resolves after the status was updated, an error occurred or 20 trials without success passed
     * @returns updated status  
     */
    requestStatusRefreshSync() {
        return new Promise(async (resolve, reject) => {
            var commandId = await this.requestStatusRefresh()
            fordHeaders.set('auth-token', this.token)
            var options = {
                baseURL: fordAPIUrl,
                url: `/api/vehicles/v3/${this.vin}/statusrefresh/${commandId}`,
                headers: Object.fromEntries(fordHeaders)
            }

            var api_status = 0;
            for (let counter = 0; counter < this.maxRefreshTrials; counter++) {                
                try {
                    var result = await request(options)
                    api_status = result.data.status
                } catch (err) {
                    console.log(err)
                }

                if (api_status == 200) {
                    return resolve(result.data.vehicleStatus)
                } else {
                    console.log(`Waiting for the status to refresh - sleeping for 1500ms - ${result.data.status}`)
                    await new Promise((resolve_sleep) => {setTimeout(resolve_sleep, 1500);});
                }
            }
            
            reject("Refresh failed!")
        })
    }

    /**
     * Requests the Ford API to contact the vehicle for updated status data
     * Does not wait until the refreshed status data is available! Use requestStatusRefreshSync for that.
     * @returns commandId to track the request
     */
    requestStatusRefresh() {
        return new Promise(async (resolve, reject) => {
            fordHeaders.set('auth-token', this.token)
            var options = {
                method: 'PUT',
                baseURL: fordAPIUrl,
                url: `/api/vehicles/v2/${this.vin}/status`,
                headers: Object.fromEntries(fordHeaders)
            }

            try {
                var result = await request(options)
            } catch (err) {
                console.log(err)
                reject(err.result.status)
            }

            if (result.status == 200) {
                return resolve(result.data.commandId)
            } else {
                return reject(result.status)
            }
        })
    }
}

exports.vehicle = vehicle
