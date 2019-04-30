'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

class CursorEncoder {
    static encodeToCursor(cursorObj) {
        const buff = Buffer.from(JSON.stringify(cursorObj));
        return buff.toString('base64');
    }
    static decodeFromCursor(cursor) {
        const buff = Buffer.from(cursor, 'base64');
        const json = buff.toString('ascii');
        return JSON.parse(json);
    }
}

const ORDER_DIRECTION = {
    asc: 'asc',
    desc: 'desc'
};
class QueryContext {
    constructor(inputArgs = {}, options = {}) {
        this.inputArgs = {
            page: {},
            cursor: {},
            filter: {},
            order: {},
            ...inputArgs
        };
        this.validateArgs();
        // private
        this.cursorEncoder = options.cursorEncoder || CursorEncoder;
        this.defaultLimit = options.defaultLimit || 1000;
        // public
        this.previousCursor = this.calcPreviousCursor();
        // the index position of the cursor in the total result set
        this.indexPosition = this.calcIndexPosition();
        this.limit = this.calcLimit();
        this.orderBy = this.calcOrderBy();
        this.orderDirection = this.calcOrderDirection();
        this.filters = this.calcFilters();
        this.offset = this.calcOffset();
    }
    /**
     * Compares the current paging direction (as indicated `first` and `last` args)
     * and compares to what the original sort direction was (as found in the cursor)
     */
    get isPagingBackwards() {
        if (!this.previousCursor) {
            return false;
        }
        const { before, after, first, last } = this.inputArgs;
        const prevCursorObj = this.cursorEncoder.decodeFromCursor(this.previousCursor);
        // tslint:disable-line
        return !!((prevCursorObj.initialSort === ORDER_DIRECTION.asc && (last || before)) ||
            (prevCursorObj.initialSort === ORDER_DIRECTION.desc && (first || after)));
    }
    /**
     * Sets the limit for the desired query result
     */
    calcLimit() {
        const { first, last } = this.inputArgs;
        const limit = first || last || this.defaultLimit;
        // If you are paging backwards, you need to make sure that the limit
        // isn't greater or equal to the index position.
        // This is because the limit is used to calculate the offset.
        // You don't want to offset larger than the set size.
        if (this.isPagingBackwards) {
            return limit < this.indexPosition ? limit : this.indexPosition - 1;
        }
        return limit;
    }
    /**
     * Sets the orderBy for the desired query result
     */
    calcOrderBy() {
        if (this.previousCursor) {
            const prevCursorObj = this.cursorEncoder.decodeFromCursor(this.previousCursor);
            return prevCursorObj.orderBy;
        }
        else {
            return this.inputArgs.orderBy || 'id';
        }
    }
    /**
     * Sets the orderDirection for the desired query result
     */
    calcOrderDirection() {
        if (this.previousCursor) {
            const prevCursorObj = this.cursorEncoder.decodeFromCursor(this.previousCursor);
            return prevCursorObj.initialSort;
        }
        else {
            const dir = this.inputArgs.last || this.inputArgs.before
                ? ORDER_DIRECTION.desc
                : ORDER_DIRECTION.asc;
            return dir;
        }
    }
    /**
     * Extracts the previous cursor from the resolver cursorArgs
     */
    calcPreviousCursor() {
        const { before, after } = this.inputArgs;
        return before || after;
    }
    /**
     * Extracts the filters from the resolver filterArgs
     */
    calcFilters() {
        if (this.previousCursor) {
            return this.cursorEncoder.decodeFromCursor(this.previousCursor).filters;
        }
        if (!this.inputArgs.filter) {
            return {};
        }
        return this.inputArgs.filter;
    }
    /**
     * Gets the index position of the cursor in the total possible result set
     */
    calcIndexPosition() {
        if (this.previousCursor) {
            return this.cursorEncoder.decodeFromCursor(this.previousCursor).position;
        }
        return 0;
    }
    /**
     * Gets the offset that the current query should start at in the total possible result set
     */
    calcOffset() {
        if (this.isPagingBackwards) {
            const offset = this.indexPosition - (this.limit + 1);
            return offset < 0 ? 0 : offset;
        }
        return this.indexPosition;
    }
    /**
     * Validates that the user is using the connection query correctly
     * For the most part this means that they are either using
     *   `first` and/or `after` together
     *    or
     *   `last` and/or `before` together
     */
    validateArgs() {
        if (!this.inputArgs) {
            throw Error('Input args are required');
        }
        const { first, last, before, after, orderBy } = this.inputArgs;
        // tslint:disable
        if (first && last) {
            throw Error('Can not mix `first` and `last`');
        }
        else if (before && after) {
            throw Error('Can not mix `before` and `after`');
        }
        else if (before && first) {
            throw Error('Can not mix `before` and `first`');
        }
        else if (after && last) {
            throw Error('Can not mix `after` and `last`');
        }
        else if ((after || before) && orderBy) {
            throw Error('Can not use orderBy with a cursor');
        }
        else if ((after || before) &&
            (this.inputArgs.filter.and ||
                this.inputArgs.filter.or)) {
            throw Error('Can not use filters with a cursor');
        }
        else if ((first != null && first <= 0) || (last != null && last <= 0)) {
            throw Error('Page size must be greater than 0');
        }
        // tslint:enable
    }
}

/**
 * KnexQueryBuilder
 *
 * A QueryBuilder that creates a query from the QueryContext using Knex
 *
 */
const defaultFilterMap = {
    '>': '>',
    '>=': '>=',
    '=': '=',
    '<': '<',
    '<=': '<=',
    '<>': '<>'
};
class KnexQueryBuilder {
    constructor(queryContext, attributeMap, options = {}) {
        this.queryContext = queryContext;
        this.attributeMap = attributeMap;
        this.filterMap = options.filterMap || defaultFilterMap;
        this.addFilterRecursively = this.addFilterRecursively.bind(this);
    }
    createQuery(queryBuilder) {
        this.applyLimit(queryBuilder);
        this.applyOrder(queryBuilder);
        this.applyOffset(queryBuilder);
        this.applyFilter(queryBuilder);
        return queryBuilder;
    }
    /**
     * Adds the limit to the sql query builder.
     *     Note: The limit added to the query builder is limit + 1
     *     to allow us to see if there would be additional pages
     */
    applyLimit(queryBuilder) {
        queryBuilder.limit(this.queryContext.limit + 1); // add one to figure out if there are more results
    }
    /**
     * Adds the order to the sql query builder.
     */
    applyOrder(queryBuilder) {
        // map from node attribute names to sql column names
        const orderBy = this.attributeMap[this.queryContext.orderBy] || this.attributeMap.id;
        const direction = this.queryContext.orderDirection;
        queryBuilder.orderBy(orderBy, direction);
    }
    applyOffset(queryBuilder) {
        const offset = this.queryContext.offset;
        queryBuilder.offset(offset);
    }
    /**
     * Adds filters to the sql query builder
     */
    applyFilter(queryBuilder) {
        this.addFilterRecursively(this.queryContext.filters, queryBuilder);
    }
    computeFilterField(field) {
        const mappedField = this.attributeMap[field];
        if (mappedField) {
            return mappedField;
        }
        throw new Error(`Filter field ${field} either does not exist or is not accessible. Check the attribute map`);
    }
    computeFilterOperator(operator) {
        const mappedField = this.filterMap[operator];
        if (mappedField) {
            return mappedField;
        }
        throw new Error(`Filter operator ${operator} either does not exist or is not accessible. Check the filter map`);
    }
    filterArgs(f) {
        return [this.computeFilterField(f.field), this.computeFilterOperator(f.operator), f.value];
    }
    addFilterRecursively(filter, queryBuilder) {
        if (isFilter(filter)) {
            queryBuilder.where(...this.filterArgs(filter));
            return queryBuilder;
        }
        // tslint:disable-next-line
        if (filter.and && filter.and.length > 0) {
            filter.and.forEach(f => {
                if (isFilter(f)) {
                    queryBuilder.andWhere(...this.filterArgs(f));
                }
                else {
                    queryBuilder.andWhere(k => this.addFilterRecursively(f, k));
                }
            });
        }
        if (filter.or && filter.or.length > 0) {
            filter.or.forEach(f => {
                if (isFilter(f)) {
                    queryBuilder.orWhere(...this.filterArgs(f));
                }
                else {
                    queryBuilder.orWhere(k => this.addFilterRecursively(f, k));
                }
            });
        }
        if (filter.not && filter.not.length > 0) {
            filter.not.forEach(f => {
                if (isFilter(f)) {
                    queryBuilder.andWhereNot(...this.filterArgs(f));
                }
                else {
                    queryBuilder.andWhereNot(k => this.addFilterRecursively(f, k));
                }
            });
        }
        return queryBuilder;
    }
}
const isFilter = (filter) => {
    return (!!filter &&
        !!filter.field &&
        !!filter.operator &&
        !!filter.value);
};

class QueryResult {
    constructor(result, queryContext, options = {}) {
        this.result = result;
        this.queryContext = queryContext;
        this.cursorEncoder = options.cursorEncoder || CursorEncoder;
        this.nodeTansformer = options.nodeTransformer;
        if (this.result.length < 1) {
            this.nodes = [];
            this.edges = [];
        }
        else {
            this.nodes = this.createNodes();
            this.edges = this.createEdgesFromNodes();
        }
    }
    get pageInfo() {
        return {
            hasPreviousPage: this.hasPrevPage,
            hasNextPage: this.hasNextPage,
            startCursor: this.startCursor,
            endCursor: this.endCursor
        };
    }
    /**
     * We over extend the limit size by 1.
     * If the results are larger in size than the limit
     * we can assume there are additional pages.
     */
    get hasNextPage() {
        // If you are paging backwards, you only have another page if the
        // offset (aka the limit) is less then the result set size (aka: index position - 1)
        if (this.queryContext.isPagingBackwards) {
            return this.queryContext.indexPosition - (this.queryContext.limit + 1) > 0;
        }
        // Otherwise, if you aren't paging backwards, you will have another page
        // if more results were fetched than what was asked for.
        // This is possible b/c we over extend the limit size by 1
        // in the QueryBuilder
        return this.result.length > this.queryContext.limit;
    }
    get hasPrevPage() {
        // If there is no cursor, then this is the first page
        // Which means there is no previous page
        if (!this.queryContext.previousCursor) {
            return false;
        }
        // If you are paging backwards, you have to be paging from
        // somewhere. Thus you always have a previous page.
        if (this.queryContext.isPagingBackwards) {
            return true;
        }
        // If you have a previous cursor and you are not paging backwards you have to be
        // on a page besides the first one. This means you have a previous page.
        return true;
    }
    /**
     * The first cursor in the nodes list
     */
    get startCursor() {
        const firstEdge = this.edges[0];
        return firstEdge ? firstEdge.cursor : '';
    }
    /**
     * The last cursor in the nodes list
     */
    get endCursor() {
        const endCursor = this.edges.slice(-1)[0];
        return endCursor ? endCursor.cursor : '';
    }
    /**
     * It is very likely the results we get back from the data store
     * have additional fields than what the GQL type node supports.
     * We trim down the result set to be within the limit size and we
     * apply an optional transform to the result data as we iterate through it
     * to make the Nodes.
     */
    createNodes() {
        let nodeTansformer;
        if (this.nodeTansformer) {
            nodeTansformer = this.nodeTansformer;
        }
        else {
            nodeTansformer = (node) => node;
        }
        return this.result.map(node => nodeTansformer({ ...node })).slice(0, this.queryContext.limit);
    }
    createEdgesFromNodes() {
        const initialSort = this.queryContext.orderDirection;
        const filters = this.queryContext.filters;
        const orderBy = this.queryContext.orderBy;
        const nodesLength = this.nodes.length;
        return this.nodes.map((node, index) => {
            const position = this.queryContext.isPagingBackwards
                ? this.queryContext.indexPosition - nodesLength - index
                : this.queryContext.indexPosition + index + 1;
            return {
                cursor: this.cursorEncoder.encodeToCursor({
                    initialSort,
                    filters,
                    orderBy,
                    position
                }),
                node: { ...node }
            };
        });
    }
}

// tslint:disable:max-classes-per-file
class ConnectionManager {
    constructor(inputArgs, inAttributeMap, options) {
        this.options = options || {};
        this.inAttributeMap = inAttributeMap;
        // 1. Create QueryContext
        this.queryContext = new QueryContext(inputArgs, this.options.contextOptions);
        // 2. Create QueryBuilder
        this.queryBuilder = new KnexQueryBuilder(this.queryContext, this.inAttributeMap, this.options.builderOptions);
    }
    createQuery(queryBuilder) {
        return this.queryBuilder.createQuery(queryBuilder);
    }
    addResult(result) {
        // 3. Create QueryResult
        this.queryResult = new QueryResult(result, this.queryContext, this.options.resultOptions);
    }
    get pageInfo() {
        if (!this.queryResult) {
            throw Error('Result must be added before page info can be calculated');
        }
        return this.queryResult.pageInfo;
    }
    get edges() {
        if (!this.queryResult) {
            throw Error('Result must be added before edges can be calculated');
        }
        return this.queryResult.edges;
    }
}

exports.ConnectionManager = ConnectionManager;
exports.QueryContext = QueryContext;
exports.QueryResult = QueryResult;
exports.CursorEncoder = CursorEncoder;
exports.KnexQueryBuilder = KnexQueryBuilder;
