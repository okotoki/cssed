declare const _default: any;
export default _default;
type CSSProperties = {
    [key: string]: string | number | CSSProperties;
};
export declare function css(_strings: TemplateStringsArray, ..._exprs: Array<string | number | CSSProperties>): {
    [ket: string]: string;
};
