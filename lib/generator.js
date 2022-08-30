const isObject = (val) => val && typeof val === 'object'
const path = require('path')
const ejs = require('ejs')
const fs = require('fs')
const { isBinaryFileSync } = require('isbinaryfile')
const ConfigTransform = require('./ConfigTransform')
const normalizeFilePaths = require('./utils/normalizeFilePaths')
const { runTransformation } = require('vue-codemod')
const sortObject = require('./utils/sortObject')
const writeFileTree = require('./utils/writeFileTree')

const defaultConfigTransforms = {
  babel: new ConfigTransform({
      file: {
          js: ['babel.config.js'],
      },
  }),
  postcss: new ConfigTransform({
      file: {
          js: ['postcss.config.js'],
          json: ['.postcssrc.json', '.postcssrc'],
          yaml: ['.postcssrc.yaml', '.postcssrc.yml'],
      },
  }),
  eslintConfig: new ConfigTransform({
      file: {
          js: ['.eslintrc.js'],
          json: ['.eslintrc', '.eslintrc.json'],
          yaml: ['.eslintrc.yaml', '.eslintrc.yml'],
      },
  }),
  jest: new ConfigTransform({
      file: {
          js: ['jest.config.js'],
      },
  }),
  browserslist: new ConfigTransform({
      file: {
          lines: ['.browserslistrc'],
      },
  }),
}

const reservedConfigTransforms = {
  vue: new ConfigTransform({
      file: {
          js: ['vue.config.js'],
      },
  }),
}

class Generator {
  constructor(pkg, context) {
    this.pkg = pkg
    this.context = context
    this.files = {}
    this.rootOptions = {}
    this.fileMiddlewares = []
    this.configTransforms = {}
    this.imports = {}
    this.entryFile = `src/main.js`
    this.reservedConfigTransforms = reservedConfigTransforms
  }
  extendPackage(fields) {
    const pkg = this.pkg
    for(const key in fields) {
      const value = fields[key]
      const existing = pkg[key]
      if (isObject(value) && ['dependencies', 'devDependencies', 'scripts'].includes(key)) {
        pkg[key] = Object.assign(existing || {}, value)
      } else {
        pkg[key] = value
      }
    }
  }
  render(source, additionalData = {}, ejsOptions = {}) {
    const baseDir = extractCallDir()
    source = path.resolve(baseDir, source)
    this._injectFileMiddlewara(async (files) => {
      const data = this._resolveData(additionalData)
      // https://github.com/sindresorhus/globby
      const globby = require('globby')
      // 读取模板目录下所有文件
      const _files = await globby(['**/*'], { cwd:source, dot: true })
      for(const rawPath of _files) {
        const sourcePath = path.resolve(source, rawPath)
        const content = this.renderFile(sourcePath, data, ejsOptions)
        // only set file if it's not all whitespace, or is a Buffer (binary files)
        if (Buffer.isBuffer(content) || /[^\s]/.test(content)) {
          files[rawPath] = content
        }
      }
    })
  }
  renderFile(name, data, ejsOptions) {
    // 如果是二进制文件，直接将读取结果返回
    if (isBinaryFileSync(name)) {
      return fs.readFileSync(name)
    }

    // 返回文件内容
    const template = fs.readFileSync(name, 'utf-8')
    return ejs.render(template, data, ejsOptions)
  }
  async generate() {
    // 从 package.json 中提取文件
    this.extractConfigFiles()
    // 解析文件内容
    await this.resolveFiles()
    this.sortPkg()
    this.files['package.json'] = JSON.stringify(this.pkg, null, 2) + '\n'
    // console.log(this)
    await writeFileTree(this.context, this.files)
  }
  // 按照下面的顺序对 package.json 中的 key 进行排序
  sortPkg() {
      // ensure package.json keys has readable order
      this.pkg.dependencies = sortObject(this.pkg.dependencies)
      this.pkg.devDependencies = sortObject(this.pkg.devDependencies)
      this.pkg.scripts = sortObject(this.pkg.scripts, [
          'dev',
          'build',
          'test:unit',
          'test:e2e',
          'lint',
          'deploy',
      ])

      this.pkg = sortObject(this.pkg, [
          'name',
          'version',
          'private',
          'description',
          'author',
          'scripts',
          'husky',
          'lint-staged',
          'main',
          'module',
          'browser',
          'jsDelivr',
          'unpkg',
          'files',
          'dependencies',
          'devDependencies',
          'peerDependencies',
          'vue',
          'babel',
          'eslintConfig',
          'prettier',
          'postcss',
          'browserslist',
          'jest',
      ])
  }
  // 提取pkg中的配置。生成单独文件
  // 例如将 package.json 中的
  // babel: {
  //     presets: ['@babel/preset-env']
  // },
  // 提取出来变成 babel.config.js 文件
  extractConfigFiles () {
    const configTransforms = {
      ...defaultConfigTransforms,
      ...this.configTransforms,
      ...reservedConfigTransforms
    }
    const extract = (key) => {
      if (configTransforms[key] && this.pkg[key]) {
        const value = this.pkg[key]
        const configTransform = configTransforms[key]
        const res = configTransform.transform(
          value,
          this.files,
          this.context
        )

        const { content, filename } = res
        this.files[filename] = ensureEOL(content)
        delete this.pkg[key]
      }
    }

    extract('vue')
    extract('babel')
  }
  async resolveFiles() {
    const files = this.files
    for (const middleware of this.fileMiddlewares) {
      await middleware(files)
    }

    normalizeFilePaths(files)

    console.log(this.imports)
    console.log(this.rootOptions)

    Object.keys(files).forEach(file => {
      let imports = this.imports[file]
      imports = imports instanceof Set ? Array.from(imports) : imports
      if (imports && imports.length > 0) {
        files[file] = runTransformation(
          { path: file, source: files[file] },
          require('./utils/codemods/injectImports'),
          { imports }
        )
      }

      let injections = this.rootOptions[file]
      injections = injections instanceof Set ? Array.from(injections) : injections
      if (injections && injections.length > 0) {
          files[file] = runTransformation(
              { path: file, source: files[file] },
              require('./utils/codemods/injectOptions'),
              { injections },
          )
      }
    })
  }
  // 合并选项
  _resolveData(additionalData) {
    return { 
        options: this.options,
        rootOptions: this.rootOptions,
        ...additionalData,
    }
  }
  _injectFileMiddlewara(middleware) {
    this.fileMiddlewares.push(middleware)
  }
  /**
   * Add import statements to a file.
   */
  injectImports(file, imports) {
      const _imports = (
          this.imports[file]
          || (this.imports[file] = new Set())
      );
      (Array.isArray(imports) ? imports : [imports]).forEach(imp => {
          _imports.add(imp)
      })
  }

  /**
   * Add options to the root Vue instance (detected by `new Vue`).
   */
  injectRootOptions(file, options) {
      const _options = (
          this.rootOptions[file]
          || (this.rootOptions[file] = new Set())
      );
      (Array.isArray(options) ? options : [options]).forEach(opt => {
          _options.add(opt)
      })
  }
}

const ensureEOL = str => {
  if (str.charAt(str.length - 1) !== '\n') {
      return str + '\n'
  }

  return str
}

// http://blog.shaochuancs.com/about-error-capturestacktrace/
// 获取调用栈信息
function extractCallDir() {
    const obj = {}
    Error.captureStackTrace(obj)
    // 在 lib\generator\xx 等各个模块中 调用 generator.render()
    // 将会排在调用栈中的第四个，也就是 obj.stack.split('\n')[3]
    const callSite = obj.stack.split('\n')[3]

    // the regexp for the stack when called inside a named function
    const namedStackRegExp = /\s\((.*):\d+:\d+\)$/
    // the regexp for the stack when called inside an anonymous
    const anonymousStackRegExp = /at (.*):\d+:\d+$/

    let matchResult = callSite.match(namedStackRegExp)
    if (!matchResult) {
        matchResult = callSite.match(anonymousStackRegExp)
    }

    const fileName = matchResult[1]
    // 获取对应文件的目录
    return path.dirname(fileName)
}

module.exports = Generator
