import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...nextVitals,
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    rules: {
      // React Compiler lint rules introduced with eslint-config-next 16. The editor predates them and
      // relies on a few ref-in-render / setState-in-effect patterns; surface them as warnings while
      // they are cleaned up rather than failing `npm run lint`.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      // Plain <img> is intentional: data-URL logo/asset previews don't benefit from next/image.
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
