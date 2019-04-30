import {ORDER_DIRECTION} from 'enums';

export interface IFilter {
    value: string;
    operator: string;
    field: string;
}

export interface ICompoundFilter {
    and?: IInputFilter[];
    or?: IInputFilter[];
    not?: IInputFilter[];
}

export type IInputFilter = IFilter | ICompoundFilter;

export interface ICursorObj<PublicAttributes> {
    orderDir: keyof typeof ORDER_DIRECTION;
    orderBy: PublicAttributes;
    // The position of the cursor item from the beginning of the query
    position: number;
    filters: IInputFilter;
}

export interface IInputArgs {
    before?: string;
    after?: string;
    first?: number;
    last?: number;
    orderBy?: string;
    orderDir?: keyof typeof ORDER_DIRECTION;
    filter?: IInputFilter;
}

export interface IInAttributeMap {
    [nodeField: string]: string;
}

export interface IFilterMap {
    [nodeField: string]: string;
}

// QueryContext
export interface IQueryContext {
    limit: number;
    orderDir: keyof typeof ORDER_DIRECTION;
    orderBy: string;
    filters: IInputFilter;
    offset: number;
    inputArgs: IInputArgs;
    previousCursor?: string;
    indexPosition: number;

    isPagingBackwards: boolean;
}

export interface IQueryContextOptions<CursorObj> {
    defaultLimit?: number;
    cursorEncoder?: ICursorEncoder<CursorObj>;
}

// CursorEncoder
export interface ICursorEncoder<CursorObj> {
    encodeToCursor: (cursorObj: CursorObj) => string;
    decodeFromCursor: (cursor: string) => CursorObj;
}

// QueryBuilder
export interface IQueryBuilder<Builder> {
    createQuery: (queryBuilder: Builder) => Builder;
}

export interface IQueryBuilderOptions {
    filterMap?: {[operator: string]: string};
}

// QueryResult
export interface IQueryResult<Node> {
    nodes: Node[];
    edges: Array<{cursor: string; node: Node}>;
    pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor: string;
        endCursor: string;
    };
    hasNextPage: boolean;
    hasPrevPage: boolean;
    startCursor: string;
    endCursor: string;
}

export type NodeTransformer<Node> = (node: any) => Node;

export interface IQueryResultOptions<CursorObj, Node> {
    cursorEncoder?: ICursorEncoder<CursorObj>;
    nodeTransformer?: NodeTransformer<Node>;
}
