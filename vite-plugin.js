const { transformAsync } = require('@babel/core')

const sourceRegex = /\.(j|t)sx?$/
const tsxRegex = /\.(j|t)sx$/ // all files are being interpreted as TS, so we'll treat JSX as TSX

module.exports = function viteCssedPlugin() {
  return {
    name: 'cssed-plugin',
    enforce: 'pre',
    async transform(source, filename) {
      if (filename.includes('node_modules')) {
        return undefined
      }

      if (!sourceRegex.test(filename)) {
        return undefined
      }

      if (!source.includes('import { css } from')) return undefined

      const result = await transformAsync(source, {
        filename,
        plugins: [
          require.resolve('@babel/plugin-syntax-jsx'),
          [
            require.resolve('@babel/plugin-syntax-typescript'),
            { isTSX: tsxRegex.test(filename) }
          ],
          require.resolve('./lib/index.js')
        ],
        babelrc: false,
        configFile: false,
        sourceMaps: true
      })

      return result
    }
  }
}
