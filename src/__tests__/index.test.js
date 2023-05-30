import pluginTester from 'babel-plugin-tester'
import plugin from '../../lib/index'

pluginTester({
  plugin,
  snapshot: true,
  babelOptions: {
    filename: __filename,
    parserOpts: {
      presets: [
        [
          'env',
          {
            modules: 'commonjs'
          }
        ],
        'react'
      ],
      plugins: ['jsx']
    }
  },
  tests: [
    {
      title: 'single call macro',
      code: `
        import { css } from 'cssed';

        const styles = css\`
          .box {
            color: blue
          }
        \`
      `
    },
    {
      title: 'single call evaluation',
      code: `
        import { css } from 'cssed';

        const blue = 'blue'

        const styles = css\`
          .box {
            color: \${blue}
          }
        \`
      `
    },
    {
      title: 'multi call macro',
      code: `
        import { css } from 'cssed';

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
      `
    },
    {
      title: 'multi call with external dependency',
      code: `
        import { css } from 'cssed';
        import { light, dark } from './module'

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
      `
    },
    {
      title: 'multi call with external module dependency',
      code: `
        import { css } from 'cssed';
        import { light, dark } from './module'

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
      `
    },
    {
      title: 'function call in expression',
      code: `
        import { css } from 'cssed';
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
      `
    },
    {
      title: 'test url rebase',
      code: `
        import { css } from 'cssed';

        const btn = css\`
        .light {
          background-image: url("star.gif");
          list-style-image: url('../images/bullet.jpg');
          font-family: 'Open Sans', sans-serif;
          border-image: url('border.png');
          content: url('/content.png');
          content: url(data:image/png;base64,iVBORw0KGgoAAAA);
        }
        \`;

        export default props => (
          <>
            <div className={btn.light} />
            <div className={btn.dark} />
          </>
        );
      `
    }
  ]
})
