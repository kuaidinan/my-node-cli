'use strict';
const fs = require('fs-extra')
// const chalk = require('chalk')
const path = require('path')
// const inquirer = require('inquirer')
// const PromptModuleAPI = require('./PromptModuleAPI')
const Creator = require('./Creator')
const clearConsole = require('./utils/clearConsole')

async function create(name) {
  const targetDir = path.join(process.cwd(), name)
  // 如果目标目录已存在，询问是覆盖还是合并
  if (fs.existsSync(targetDir)) {
    clearConsole()
    const { action } = await inquirer.prompt([
      {
        name: 'action',
        type: 'list',
        message: `Target directory ${chalk.cyan(targetDir)} already exists. Pick an action:`,
        choices: [
            { name: 'Overwrite', value: 'overwrite' },
            { name: 'Merge', value: 'merge' },
        ],
      }
    ])
  
    if (action === 'overwrite') {
      console.log(`\nRemoving ${chalk.cyan(targetDir)}...`)
      await fs.remove(targetDir)
    }
  }

  const creator = new Creator()

}

module.exports = create;
