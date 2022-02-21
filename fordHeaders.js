// setup header objects
const defaultHeaders = new Map([
    ['Accept', '*/*'],
    ['Accept-Language', 'en-us'],
    ['Content-Type', 'application/json'],
    ['User-Agent', 'FordPass/5 CFNetwork/1327.0.4 Darwin/21.2.0'],
    ['Accept-Encoding', 'gzip, deflate, br']
])

module.exports.fordHeaders = fordHeaders = new Map([
    ...defaultHeaders,
    ['Application-Id', "71A3AD0A-CF46-4CCF-B473-FC7FE5BC4592"]
])

module.exports.iamHeaders = iamHeaders = new Map([
    ...defaultHeaders,
    ['Content-Type', 'application/x-www-form-urlencoded']
])
