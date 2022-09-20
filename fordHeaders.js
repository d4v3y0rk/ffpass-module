// setup header objects
const defaultHeaders = new Map([
    ['Accept', '*/*'],
    ['User-Agent', 'FordPass/5 CFNetwork/1327.0.4 Darwin/21.2.0'],
    ['Accept-Language', 'en-US,en;q=0.9'],
    ['Accept-Encoding', 'gzip, deflate, br']
])

module.exports.defaultHeaders = defaultHeaders

module.exports.fordHeaders = fordHeaders = new Map([
    ...defaultHeaders,
    ['Application-Id', "71A3AD0A-CF46-4CCF-B473-FC7FE5BC4592"]
])
