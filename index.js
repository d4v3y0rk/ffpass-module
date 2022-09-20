const request = require('axios')
const wrapper = require('axios-cookiejar-support')
const CookieJar = require('tough-cookie')
const pkceChallenge = require('pkce-challenge').default;

// https://github.com/axios/axios/issues/41#issuecomment-484546457
// By default, axios throws errors for http request.status < 200 || request.status >= 300
// This makes sure that it does not treat said status codes as errors = rejects the promise
//request.defaults.validateStatus = function () { return true; };

const { fordHeaders, defaultHeaders} = require('./fordHeaders');
const { start } = require('repl');

const fordAPIUrl = 'https://usapi.cv.ford.com'
const authUrl = 'https://sso.ci.ford.com'
const tokenUrl = "https://api.mps.ford.com"
const client_id = "9fb503e0-715b-47e8-adfd-ad4b7770f73b"
const app_id = "71A3AD0A-CF46-4CCF-B473-FC7FE5BC4592"

class vehicle {
    constructor(username, password, vin) {
        this.username = username,
        this.password = password,
        this.vin = vin,
        this.token = "",
        this.outdatedAfterSeconds = 5 * 60,
        this.maxRefreshTrials = 20
    }

    findRegexMatch(regex, html) {
        const match = regex.exec(html);
        if (match) {
            return match[1];
        }
        return undefined;
    }

    async auth() {
        const jar = new CookieJar.CookieJar();
        const client = wrapper.wrapper(request.create({jar}));
        const pkce = pkceChallenge();

        const webSession = await this.initializeWebSession(client, pkce.code_challenge)
        .then(async (authURL) => {
            return this.attemptLogin(authURL, this.username, this.password, client).then(async (url) => {
                return this.fetchAuthorizationCode(url, client).then((data) => data
                );
            });
        })
        .catch(err => {
            throw err;
        });

        const data = {
            client_id: client_id,
            grant_type: 'authorization_code',
            code: webSession.code,
            redirect_uri: 'fordapp://userauthorized',
            grant_id: webSession.grantId,
            code_verifier: pkce.code_verifier,
        };

        const access_token = await this.requestAccessToken(data);
        this.token = access_token;
        return access_token;
    }

    async initializeWebSession(client, code_challenge) {
        const headers = Object.fromEntries(defaultHeaders);
        return client.get(
            `https://sso.ci.ford.com/v1.0/endpoint/default/authorize?redirect_uri=fordapp://userauthorized&response_type=code&scope=openid&max_age=3600&client_id=9fb503e0-715b-47e8-adfd-ad4b7770f73b&code_challenge=${code_challenge}%3D&code_challenge_method=S256`,
            {
                headers: headers,
            }
        )
        .then(async res => {
            if (res.status === 200) {
                const authURL = 'https://sso.ci.ford.com' + this.findRegexMatch(/data-ibm-login-url="(.*)" /gm, res.data);
                if (authURL) return authURL;
                throw new Error('Could not find auth URL');
            }
            throw new Error('Initialize WebSession: Unhandled success status code');
        })
        .catch(err => {throw err;});
    }

    async attemptLogin(url, username, password, client) {
        const headers = Object.fromEntries(defaultHeaders);
        return client.post(
            url,
            new URLSearchParams({
                operation: 'verify',
                'login-form-type': 'pwd',
                username: username,
                password: password,
            }).toString(),
            {
                maxRedirects: 0,
                headers: {
                   'Content-Type': 'application/x-www-form-urlencoded',
                    ...headers,
                  },
            }
          )
          .then(() => {
            throw new Error('Attempt Login: Unhandled success status code');
          })
          .catch(err => {
            if (err?.response?.status === 302) {
                return err.response.headers.location;
            }
            throw new Error('Attempt Login: Unhandled Error Code');
          });
    }

    async fetchAuthorizationCode(url, client) {
        const headers = Object.fromEntries(defaultHeaders);
        return client.get(url, {
            maxRedirects: 0,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              ...headers,
            },
          })
          .then(() => {
            throw new Error('Fetch Authorization Code: Unhandled Success Code');
          })
          .catch(err => {
            if (err.response.status === 302) {
              const code = this.findRegexMatch(/code=(.*)&/gm, err.response.headers.location);
              const grantId = this.findRegexMatch(/&grant_id=(.*)/gm, err.response.headers.location);
    
              if (code && grantId) return {code, grantId};
              throw new Error('Fetch Authorization Code: Missing Code or Grant ID');
            }
            throw new Error('Fetch Authorization Code: Unhandled Error Code');
          });
    }

    async requestAccessToken(data) {
        const headers = Object.fromEntries(defaultHeaders);
        const accessToken = await request.post(
            `https://sso.ci.ford.com/oidc/endpoint/default/token`,
            new URLSearchParams(data).toString(),
            {
              headers: {
                ...headers,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
        )
        .then(async res => {
            if (res.status === 200 && res.data.access_token) {
                return await request.post(
                    'https://api.mps.ford.com/api/token/v2/cat-with-ci-access-token',
                    {
                        ciToken: res.data.access_token,
                    },
                    {
                        headers: {
                            ...headers,
                            'Content-Type': 'application/json',
                            'Application-Id': app_id,
                        },
                    }
                )
                .then(res => {
                    return res.data.access_token;
                    //return {
                    //    "access_token": res.data.access_token,
                    //    "expires_in": res.data.expires_in,
                    //    "refresh_token": res.data.refresh_token
                    //};
                })
                .catch(err => {
                    throw err;
                });
            } else throw new Error('Access Token was not returned');
        })
        .catch(err => {
            let status = err.response.status;
            let message = err.message;
            if (err.response.data.status) status = err.response.data.status;
            if (err.response.data.message) message = err.response.data.message;
            throw new Error(message);
        });
        return accessToken;
    }

    status() {
        return new Promise(async (resolve, reject) => {
            fordHeaders.set('auth-token', this.token)
            var options = {
                baseURL: fordAPIUrl,
                url: `/api/vehicles/v5/${this.vin}/status`,
                headers: Object.fromEntries(fordHeaders),
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
                url: `/api/vehicles/v5/${this.vin}/statusrefresh/${commandId}`,
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
