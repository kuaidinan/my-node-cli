const ora = require('ora')
const { getRepoList, getTagList } = require('./http')
const inquirer = require('inquirer')
const util = require('util')
const downloadGitRepo = require('download-git-repo')
const path = require('path')
const chalk = require('chalk')

async function wrapLoading(fn, message, ...arg) {
  const spinner = ora(message)

  spinner.start()

  try {
    const result = await fn(...arg)
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail('Request failed')
  }
}

class Generator {
  constructor (name, targetDir) {
    this.name = name;

    this.targetDir = targetDir;

    this.downloadGitRepo = util.promisify(downloadGitRepo)
  }
  // 下载远程模板
  // 1）拼接下载地址
  // 2）调用下载方法
  async download(repo, tag) {
    const requestUrl = `zhurong-cli/${repo}${tag?'#'+tag:''}`

    await wrapLoading(
      this.downloadGitRepo,
      'waiting download template',
      requestUrl,
      path.resolve(process.cwd(), this.targetDir)
    )
  }
  // 获取用户选择的模板
  // 1）从远程拉取模板数据
  // 2）用户选择自己新下载的模板名称
  // 3）return 用户选择的名称
  async getRepo() {
    const repoList = await wrapLoading(getRepoList, 'waiting fetch template')
    if (!repoList) return

    const repos = repoList.map(item => item.name)

    console.log(repos)

    const res = await inquirer.prompt({
      name: 'repo',
      type: 'list',
      choices: repos,
      message: 'Please choose a template to create project'
    })

    console.log(res)
    return res.repo
  }
  // 获取用户选择的版本
  // 1）基于 repo 结果，远程拉取对应的 tag 列表
  // 2）用户选择自己需要下载的 tag
  // 3）return 用户选择的 tag
  async getTag(repo) {
    const tags = await wrapLoading(getTagList, 'waiting fetch tag', repo)
    if (!tags) return
    console.log(tags)

    const tagsList = tags.map(item => item.name)

    const res = await inquirer.prompt({
      name: 'tag',
      type: 'list',
      choices: tagsList,
      message: 'Please choose a tag to create project'
    })

    console.log(res)

    return res.tag
  }
  // 核心创建逻辑
  // 1）获取模板名称
  // 2）获取 tag 名称
  // 3）下载模板到模板目录
  async create() {
    const repo = await this.getRepo()

    const tag = await this.getTag(repo)

    console.log('repo=', repo, tag)
    await this.download(repo, tag)

    // 4）模板使用提示
    console.log(`\r\nSuccessfully created project ${chalk.cyan(this.name)}`)
    console.log(`\r\n  cd ${chalk.cyan(this.name)}`)
    console.log('  npm run dev\r\n')
  }
}

module.exports = Generator