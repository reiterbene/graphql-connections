import { ORDER_DIRECTION } from './enums';
export declare type IFilterValue = string | number | boolean | null;
export interface IFilter {
    value: IFilterValue | IFilterValue[];
    operator: string;
    field: string;
}
export interface ICompoundFilter {
    and?: IInputFilter[];
    or?: IInputFilter[];
    not?: IInputFilter[];
}
export declare type IInputFilter = IFilter | ICompoundFilter;
export declare type FilterTransformer = (filter: IFilter) => IFilter;
export interface ICursorObj<PublicAttributes> {
    orderDir: keyof typeof ORDER_DIRECTION;
    orderBy: PublicAttributes;
    position: number;
    filters: IInputFilter;
    search?: string;
}
export interface IInputArgs {
    before?: string;
    after?: string;
    first?: number;
    last?: number;
    orderBy?: string;
    orderDir?: keyof typeof ORDER_DIRECTION;
    filter?: IInputFilter;
    search?: string;
}
export interface IInAttributeMap {
    [nodeField: string]: string;
}
export interface IFilterMap {
    [nodeField: string]: string;
}
export interface IQueryContext {
    limit: number;
    orderDir: keyof typeof ORDER_DIRECTION;
    orderBy: string;
    filters: IInputFilter;
    offset: number;
    search?: string;
    inputArgs: IInputArgs;
    previousCursor?: string;
    indexPosition: number;
    isPagingBackwards: boolean;
}
export interface IQueryContextOptions<CursorObj> {
    defaultLimit?: number;
    cursorEncoder?: ICursorEncoder<CursorObj>;
}
export interface ICursorEncoder<CursorObj> {
    encodeToCursor: (cursorObj: CursorObj) => string;
    decodeFromCursor: (cursor: string) => CursorObj;
}
export interface IQueryBuilder<Builder> {
    createQuery: (queryBuilder: Builder) => Builder;
}
export declare type QueryBuilderOptions = IKnexQueryBuilderOptions | IKnexMySQLQueryBuilderOptions;
export interface IKnexQueryBuilderOptions {
    filterMap?: {
        [operator: string]: string;
    };
    /**
     * If given with `useSuggestedValueLiteralTransforms`
     * note that coercion happens FIRST, and then filterTransformer.
     */
    filterTransformer?: FilterTransformer;
    useSuggestedValueLiteralTransforms?: boolean;
}
export interface IKnexMySQLQueryBuilderOptions extends IKnexQueryBuilderOptions {
    filterMap?: {
        [operator: string]: string;
    };
    filterTransformer?: FilterTransformer;
    useSuggestedValueLiteralTransforms?: boolean;
    searchColumns?: string[];
    searchModifier?: 'IN NATURAL LANGUAGE MODE' | 'IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION' | 'IN BOOLEAN MODE' | 'WITH QUERY EXPANSION' | string;
}
export interface IQueryResult<Node> {
    edges: Array<{
        cursor: string;
        node: Node;
    }>;
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
        endCursor: string;
    };
}
export declare type NodeTransformer<Node> = (node: any) => Node;
export interface IQueryResultOptions<CursorObj, Node> {
    cursorEncoder?: ICursorEncoder<CursorObj>;
    nodeTransformer?: NodeTransformer<Node>;
}
