import { types } from '@babel/core'
import { NodePath } from '@babel/traverse'

import evaluate from '../eval'
import { EvalRule } from '../types'
import isSerializable from '../utils/isSerializable'
import numToChar from '../utils/numToChar'
import stripLines from '../utils/stripLines'
import throwIfInvalid from '../utils/throwIfInvalid'
import toCSS from '../utils/toCSS'
import { units } from '../utils/units'

// Match any valid CSS units followed by a separator such as ;, newline etc.
const unitRegex = new RegExp(`^(${units.join('|')})(;|,|\n| |\\))`)

type Interpolation = {
  id: string
  node: types.Expression
  source: string
  unit: string
}

export interface CSSed {
  importName: string
  cssText: string
}

export interface State extends babel.PluginPass {
  cssed: CSSed[]
  index: number
}

function isRef(path: NodePath<types.TaggedTemplateExpression>) {
  let isReferenced = true

  const parent = path.findParent(
    (p) =>
      types.isObjectProperty(p) ||
      types.isJSXOpeningElement(p) ||
      types.isVariableDeclarator(p)
  )

  if (parent) {
    const parentNode = parent.node
    if (
      types.isVariableDeclarator(parentNode) &&
      types.isIdentifier(parentNode.id)
    ) {
      const { referencePaths } = path.scope.getBinding(parentNode.id.name) || {
        referencePaths: []
      }

      isReferenced = referencePaths.length !== 0
    }
  }

  return isReferenced
}

export default function TaggedTemplateExpression(
  path: NodePath<types.TaggedTemplateExpression>,
  state: State,
  rules: EvalRule[]
) {
  const { quasi } = path.node

  // Increment the index of the style we're processing
  // Used for style import variable name generation
  state.index++

  const interpolations: Interpolation[] = []

  // Check if the variable is referenced anywhere for basic DCE
  // Only works when it's assigned to a variable
  let isReferenced = isRef(path)

  // Serialize the tagged template literal to a string
  let cssText = ''

  const expressions = path.get('quasi').get('expressions')

  quasi.quasis.forEach((el, i, self) => {
    let appended = false

    if (i !== 0 && el.value.cooked) {
      // Check if previous expression was a CSS variable that we replaced
      // If it has a unit after it, we need to move the unit into the interpolation
      // e.g. `var(--size)px` should actually be `var(--size)`
      // So we check if the current text starts with a unit, and add the unit to the previous interpolation
      // Another approach would be `calc(var(--size) * 1px), but some browsers don't support all units
      // https://bugzilla.mozilla.org/show_bug.cgi?id=956573
      const matches = el.value.cooked.match(unitRegex)

      if (matches) {
        const last = interpolations[interpolations.length - 1]
        const [, unit] = matches

        if (last && cssText.endsWith(`var(--${last.id})`)) {
          last.unit = unit
          cssText += el.value.cooked.replace(unitRegex, '$2')
          appended = true
        }
      }
    }

    if (!appended) {
      cssText += el.value.cooked
    }

    const ex = expressions[i]

    if (ex) {
      const { end } = ex.node.loc!
      const result = ex.evaluate()

      // The location will be end of the current string to start of next string
      const next = self[i + 1]
      const loc = {
        // +1 because the expressions location always shows 1 column before
        start: { line: el.loc!.end.line, column: el.loc!.end.column + 1 },
        end: next
          ? { line: next.loc!.start.line, column: next.loc!.start.column }
          : { line: end.line, column: end.column + 1 }
      }

      if (result.confident) {
        throwIfInvalid(result.value, ex)

        if (isSerializable(result.value)) {
          // If it's a plain object, convert it to a CSS string
          cssText += stripLines(loc, toCSS(result.value))
        } else {
          cssText += stripLines(loc, result.value)
        }
      } else {
        // Try to preval the value
        if (
          !(
            types.isFunctionExpression(ex) ||
            types.isArrowFunctionExpression(ex)
          )
        ) {
          let evaluation

          try {
            evaluation = evaluate(ex, types, state.file.opts.filename!, rules)
          } catch (e) {
            throw ex.buildCodeFrameError(
              `An error occurred when evaluating the expression: ${e.message}. Make sure you are not using a browser or Node specific API.`
            )
          }

          const { value } = evaluation

          throwIfInvalid(value, ex)

          // Only insert text for non functions
          // We don't touch functions because they'll be interpolated at runtime
          if (typeof value !== 'function') {
            if (isSerializable(value)) {
              cssText += stripLines(loc, toCSS(value))
            } else {
              // For anything else, assume it'll be stringified
              cssText += stripLines(loc, value)
            }
            return
          }
        }

        // CSS custom properties can't be used outside components
        throw ex.buildCodeFrameError(
          `The CSS cannot contain JavaScript expressions when using the 'css' tag. To evaluate the expressions at build time, pass 'evaluate: true' to the babel plugin.`
        )
      }
    }
  })

  const importName = `_${numToChar(state.index)}`
  path.replaceWith(types.identifier('_cssed' + importName))

  const result: CSSed = {
    cssText,
    importName
  }

  state.cssed.push(result)

  if (!isReferenced && !cssText.includes(':global')) {
    return
  }
}
