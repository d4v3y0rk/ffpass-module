const request = require('axios')
const qs = require('querystring')

const { fordHeaders, iamHeaders} = require('./fordHeaders')

const fordAPIUrl = 'https://usapi.cv.ford.com/'
const authUrl = 'https://fcis.ice.ibmcloud.com/'

class vehicle {
    constructor(username, password, vin) {
        this.username = username,
        this.password = password,
        this.vin = vin,
        this.token = ""
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
                url: 'v1.0/endpoint/default/token',
                headers: Object.fromEntries(iamHeaders),
                data: qs.stringify(Object.fromEntries(requestData))
            }
            var result = await request(options)
            if (result.status == 200) {
                this.token = result.data.access_token
                resolve(result.data.access_token)
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
            var result = await request(options)
            if (result.status == 200) {
                resolve(result.data.vehiclestatus)
            } else {
                reject(result.status)
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
                url = `api/vehicles/v2/${this.vin}/engine/start`
            } else if (command == 'stop') {
                method = 'DELETE'
                url = `api/vehicles/v2/${this.vin}/engine/start`
            } else if (command == 'lock') {
                method = 'PUT'
                url = `api/vehicles/v2/${this.vin}/doors/lock`
            } else if (command == 'unlock') {
                method = 'DELETE'
                url = `api/vehicles/v2/${this.vin}/doors/lock`
            } else {
                reject('No command specified for issueCommand!')
            }
            var options = {
                method: method,
                baseURL: fordAPIUrl,
                url: url,
                headers: Object.fromEntries(fordHeaders),
            }
            var result = await request(options)
            if (result.status == 200) {
                resolve(result.data)
            } else {
                reject(result.status)
            }
        })
    }
    
    commandStatus(command, commandId) {
        return new Promise(async (resolve, reject) => {
            var url = ""
            if (command == 'start' || command == 'stop') {
                url = `api/vehicles/v2/${this.vin}/engine/start/${commandId}`
            } else if (command == 'lock' || command == 'unlock') {
                url = `api/vehicles/v2/${this.vin}/doors/lock/${commandId}`
            } else {
                reject('no command specified for commandStatus')
            }
            fordHeaders.set('auth-token', this.token)
            var options = {
                baseURL: fordAPIUrl,
                url: url,
                headers: Object.fromEntries(fordHeaders),
            }
            var result = await request(options)
            if (result.status == 200) {
                resolve(result.data.status)
            } else {
                reject(result.status)
            }
        })
    }
}

exports.vehicle = vehicle