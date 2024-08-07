import { types } from '@babel/core'
import generator from '@babel/generator'

import Module from './module'

import type { PluginItem, TransformOptions } from '@babel/core'
import type { NodePath } from '@babel/traverse'
import type { Location, Value, EvalRule } from '../types'

interface IRequirement {
  result: types.Node
  path: NodePath
  start: Location
  end: Location
}

const isAdded = (requirements: IRequirement[], path: NodePath): boolean => {
  if (requirements.some((req) => req.path === path)) {
    return true
  }

  if (path.parentPath) {
    return isAdded(requirements, path.parentPath)
  }

  return false
}

const resolve = (
  path: NodePath<types.Identifier>,
  requirements: IRequirement[]
) => {
  const binding = path.scope.getBinding(path.node.name)

  if (
    path.isReferenced() &&
    binding &&
    // Next condition it's always true because `params` isn't valid value
    (binding.kind as string) !== 'param' &&
    !isAdded(requirements, binding.path)
  ) {
    let result

    switch (binding.kind) {
      case 'module':
        if (types.isImportSpecifier(binding.path)) {
          const p = binding.path as NodePath<types.ImportSpecifier>
          result = types.importDeclaration(
            [p.node],
            (p.parentPath.node as types.ImportDeclaration).source
          )
        } else {
          result = binding.path.parentPath.node
        }
        break
      case 'const':
      case 'let':
      case 'var': {
        const { node } = binding.path as NodePath<types.VariableDeclarator>
        let decl

        // Replace SequenceExpressions (expr1, expr2, expr3, ...) with the last one
        if (types.isSequenceExpression(node.init)) {
          decl = types.variableDeclarator(
            node.id,
            node.init.expressions[node.init.expressions.length - 1]
          )
        } else {
          decl = node
        }

        result = types.variableDeclaration(binding.kind, [decl])
        break
      }
      default:
        result = binding.path.node
        break
    }

    const { loc } = binding.path.node

    requirements.push({
      result,
      path: binding.path,
      start: loc!.start,
      end: loc!.end
    })

    binding.path.traverse({
      Identifier(p) {
        resolve(p, requirements)
      }
    })
  }
}

export default function evaluate(
  path: any,
  t: any,
  filename: string,
  rules: EvalRule[]
) {
  if (t.isSequenceExpression(path)) {
    // We only need to evaluate the last item in a sequence expression, e.g. (a, b, c)
    // eslint-disable-next-line no-param-reassign
    path = path.get('expressions')[path.node.expressions.length - 1]
  }

  const requirements: IRequirement[] = []

  if (t.isIdentifier(path)) {
    resolve(path, requirements)
  } else {
    path.traverse({
      Identifier(p: NodePath<types.Identifier>) {
        resolve(p, requirements)
      }
    })
  }

  const expression = t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier('module'), t.identifier('exports')),
      path.node
    )
  )

  // Preserve source order
  requirements.sort((a, b) => {
    if (a.start.line === b.start.line) {
      return a.start.column - b.start.column
    }

    return a.start.line - b.start.line
  })

  // We'll wrap each code in a block to avoid collisions in variable names
  // We separate out the imports since they cannot be inside blocks
  const { imports, others } = requirements.reduce(
    (acc, curr) => {
      if (t.isImportDeclaration(curr.path.parentPath)) {
        acc.imports.push(curr.result)
      } else {
        // Add these in reverse because we'll need to wrap in block statements in reverse
        acc.others.unshift(curr.result)
      }

      return acc
    },
    { imports: [] as types.Node[], others: [] as types.Node[] }
  )

  const wrapped = others.reduce(
    (acc, curr) => t.blockStatement([curr, acc]),
    t.blockStatement([expression])
  )

  const m = new Module(filename, rules)

  m.dependencies = []
  m.transform = function transform(this: Module, text) {
    console.log('>> here', text)
    return { code: text }
  }

  m.evaluate(
    [
      // Use String.raw to preserve escapes such as '\n' in the code
      // Flow doesn't understand template tags: https://github.com/facebook/flow/issues/2616
      /* $FlowFixMe */
      imports.map((node) => String.raw`${generator(node).code}`).join('\n'),
      /* $FlowFixMe */
      String.raw`${generator(wrapped).code}`
    ].join('\n')
  )

  return {
    value: m.exports as Value,
    dependencies: m.dependencies
  }
}
