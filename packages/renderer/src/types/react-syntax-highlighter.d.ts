declare module 'react-syntax-highlighter' {
  import * as React from 'react';
  
  export interface SyntaxHighlighterProps {
    language?: string;
    style?: any;
    showLineNumbers?: boolean;
    customStyle?: React.CSSProperties;
    wrapLines?: boolean;
    wrapLongLines?: boolean;
    children: string;
  }
  
  export const Prism: React.FC<SyntaxHighlighterProps>;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const oneDark: any;
  export const oneLight: any;
}