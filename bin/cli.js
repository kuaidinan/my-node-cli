#! /usr/bin/env node
const program = require('commander')
const chalk = require('chalk')

// 配置config命令
program
  .command('config [value]')
  .description('inspect and modify the config')
  .option('-g, --get <path>', 'get value from option')
  .option('-s, --set <path> <value>')
  .option('-d, --delete <path>', 'delete option from config')
  .action((value, options) => {
    console.log(value, options)
  })

// 配置ui
program
  .command('ui')
  .description('start and open roc-cli ui')
  .option('-p, --port <port>', 'Port used for the UI Server')
  .action((option) => {
    console.log(option)
  })

program
  .on('--help', () => {
    console.log(`\r\nRun ${chalk.cyan(`xq <command> --help`)} for detailed usage of given command\r\n`)
  })

program
  .command('create <app-name>')
  .description('create a new project')
    // -f or --force 为强制创建，如果创建的目录存在则直接覆盖
  .option('-f, --force', 'overwrite target directory if it exist')
  .action((name, options) => {
    console.log(`name:${name},options:`, options)
    require('../lib/create')(name, options)
  })

program
   // 配置版本号信息
  .version(`v${require('../package-lock.json').version}`)
  .usage('<command> [option]')

// 解析用户执行命令传入参数
program.parse(process.arg)