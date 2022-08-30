const stripAnsi = require('strip-ansi')
const { clearConsole } = require('../lib/logger')
const fs = require('fs-extra')
const path = require('path')
const { exit } = require('process')
const pwd = process.cwd()
let a = stripAnsi('\u001B[4mUnicorn\u001B[0m');
let b = stripAnsi('\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007');
console.log(a, b)
clearConsole()
// fs.ensureDirSync(a, '0o700')