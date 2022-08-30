const stringifyJS = require('./stringifyJS')

const transformJS = {
  write: ({ value }) => `module.exports = ${stringifyJS(value, null, 4)}`
}
module.exports = {
  js: transformJS
}