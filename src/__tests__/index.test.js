import plugin from 'babel-plugin-macros'
import pluginTester from 'babel-plugin-tester'

pluginTester({
  plugin,
  snapshot: true,
  babelOptions: { filename: __filename, parserOpts: { plugins: ['jsx'] } },
  tests: [
    {
      title: 'single call macro',
      code: `
        import { css } from '../../lib/macro';

        const styles = css\`
          .box {
            color: blue
          }
        \`
      `,
    },
    {
      title: 'multi call macro',
      code: `
        import { css } from '../../lib/macro';

        const blue = css\`
        .box {
          color: blue;
        }
        \`;

        const red = css\`
        .box {
          color: red;
        }
        \`;

        export default props => (
          <div className={props.isRed ? red.box : blue.box} />
        );
      `,
    },
    {
      title: 'multi call with external dependency',
      code: `
        import { css } from '../../lib/macro';
        import { light, dark } from './constant'

        const btn = css\`
        .light {
          color: \${light};
        }
        .dark {
          color: \${dark};
        }
        \`;

        export default props => (
          <>
            <div className={btn.light} />
            <div className={btn.dark} />
          </>
        );
      `,
    },
    {
      title: 'function call in expression',
      code: `
        import { css } from '../../lib/macro';
        import { light, dark } from './constant'

        const darkOrLight = (bool) => bool ? light : dark
        const btn = css\`
        .light {
          color: \${darkOrLight(true)};
        }
        .dark {
          color: \${darkOrLight(false)};
        }
        \`;

        export default props => (
          <>
            <div className={btn.light} />
            <div className={btn.dark} />
          </>
        );
      `,
    },
  ],
});
