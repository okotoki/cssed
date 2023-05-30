import type babelCore from '@babel/core'
import { createHash } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join, relative, resolve } from 'path'
import TaggedTemplateExpression from './visitors/taggedTemplateExpression'
const { addDefault } = require('@babel/helper-module-imports')

type CSSProperties = {
  [key: string]: string | number | CSSProperties
}

// Exporting css function for proper typings when using it
export function css(
  _strings: TemplateStringsArray,
  ..._exprs: Array<string | number | CSSProperties>
): { [ket: string]: string } {
  throw new Error(
    'Using the "css" tag in runtime is not supported. Make sure you have set up the Babel plugin correctly.'
  )
}

type VisitorState = {
  cssed: CSSed[]
  index: number
}

interface CSSed {
  importName: string
  cssText: string
}

const PACKAGE_NAME = 'cssed'

const CACHE_DIR = join(process.cwd(), '.cssed')

const createHashFn = (data: string, len: number) => {
  return createHash('shake256', { outputLength: len })
    .update(data)
    .digest('hex')
}

const hash = (data: string) => createHashFn(data, 8)

export default function cssedPlugin(): babelCore.PluginObj<VisitorState> {
  mkdirSync(CACHE_DIR, { recursive: true })
  const cwd = process.cwd()

  return {
    name: 'cssed',
    pre() {
      this.cssed = [] as CSSed[]
      this.index = 0
    },
    post(file) {
      const filename = file.opts.filename
      // never
      if (!filename) return

      const dir = dirname(filename)
      const cleanFilename = basename(filename).replace(/\?.*$/, '')
      const relativeDirname = relative(cwd, dir)
      const relativeFilenamePath = join(relativeDirname, cleanFilename)

      this.cssed.forEach(({ importName, cssText }, _, self) => {
        const multiple = self.length > 1

        // output css file
        const outFile =
          hash(relativeFilenamePath) +
          (multiple ? importName : '') +
          '.module.css'
        const outFilePath = join(CACHE_DIR, outFile)
        const importFilePath = relative(dir, outFilePath)

        /**
         * include this file as an import to the referenced module,
         * so that css-loader can pick it up at bundle - time.
         *
         * Macros runs in single file mode, so we can pass ['0'] reference.
         */
        addDefault(file.path, importFilePath, {
          nameHint: '_cssed' + importName
        })

        saveFileIfChanged(outFilePath, rebaseUrlInCss(cssText, dir, CACHE_DIR))
      })
    },
    visitor: {
      ImportDeclaration(path) {
        if (path.node.source.value === PACKAGE_NAME) {
          path.remove()
        }
      },
      TaggedTemplateExpression(path, state) {
        TaggedTemplateExpression(path, state as any)
      }
    }
  }
}

// Read the file first to compare the content
// Write the new content only if it's changed
// This will prevent unnecessary reloads
const saveFileIfChanged = (filePath: string, cssText: string) => {
  let currentCssText

  try {
    currentCssText = readFileSync(filePath, 'utf-8')
  } catch (e) {
    // Ignore error
  }

  const warning = '/* AUTO GENERATED FILE. DO NOT EDIT  */\n'
  const content = warning + cssText
  // if the files hasn't changed, nothing more to do

  if (currentCssText === content) return
  writeFileSync(filePath, content)
}

const rebaseUrlInCss = (
  cssText: string,
  cssFileDir: string,
  cacheDir: string
) => {
  const regex = /url\((["']?)(.*?)\1\)/g

  const rebasedCSS = cssText.replace(regex, (match, quote, url) => {
    if (!/^(\/|data:|http[s]?)/i.test(url)) {
      const absolutePath = relative(cacheDir, resolve(cssFileDir, url))
      // console.log('rebaseUrlInCss', resolve(cssFileDir, url), cacheDir, absolutePath, url)
      return `url(${quote}${absolutePath}${quote})`
    }
    return match
  })

  return rebasedCSS
}
