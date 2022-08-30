const { hasProjectYarn } = require("./utils/env")

class PackageManager {
  constructor(path, packageManager) {
    this.path = path
    this._registries = {}
    if (packageManager) {
      this.bin = packageManager
    } else if (path) {
      if (hasProjectYarn(path)) {
        this.bin = 'yarn'
      } else {
        this.bin = 'npm'
      }
    }
  }
}

module.exports = PackageManager