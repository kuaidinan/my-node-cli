const path = require('path')
const fs = require('fs-extra')
const inquirer = require('inquirer')
const chalk = require('chalk')
const Creator = require('./Creator')
const PromptModuleAPI = require('./PromptModuleAPI')
const PackageManager = require('./PackageManager')
const Generator = require('./Generator')
const { log } = require('./utils/logger')
const { saveOptions, savePreset, rcPath } = require('./utils/options')

async function create(name) {
  const targetDir = path.join(process.cwd(), name)
  // 如果目标目录已存在，询问是覆盖还是合并
  if (fs.existsSync(targetDir)) {
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
      fs.remove(targetDir)
    }

    console.log(action)
  }

  const creator = new Creator()
  const promptAPI = new PromptModuleAPI(creator)
  const PromptModules = loadPromptModules()
  PromptModules.map(m => m(promptAPI))

  // 弹出交互提示语并获取用户选择
  const answers = await inquirer.prompt(creator.getFinalPrompts())

  if (answers.preset !== '__manual__') {
    const preset = creator.getPresets()[answers.preset]
    Object.keys(preset).forEach(key => {
      answers[key] = preset[key]
    })
  }

  console.log(answers)

  // 保存包管理器选项
  if (answers.packageManager) {
    saveOptions({
      packageManager: answers.packageManager
    })
  }

  // 保存预设
  if (answers.save && answers.saveName && savePreset(answers.saveName, answers)) {
    log()
    log(`Preset ${chalk.yellow(answers.saveName)} saved in ${chalk.yellow(rcPath)}`)
  }

  const pm = new PackageManager(targetDir, answers.packageManager)

  const pkg = {
    name,
    version: '0.1.0',
    dependencies: {},
    devDependencies: {}
  }

  const generator = new Generator(pkg, targetDir)

  // 填入 vue webpack 必选项，无需用户选择
  answers.features.unshift('vue', 'webpack')

  // 根据用户选择的选项加载相应的模块，在 package.json 写入对应的依赖项
  // 并且将对应的 template 模块渲染
  answers.features.forEach(feature => {
    require(`./generator/${feature}`)(generator, answers)
  })

  await generator.generate()
}

function loadPromptModules() {
  return ['router', 'babel', 'linter', 'vuex'].map(key => require(`./promptModules/${key}.js`))
}

module.exports = create
