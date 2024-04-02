import { Knex } from 'knex';
/**
 * Knex does not provide a createRawFromQueryBuilder, so this fills in what Knex does in:
 * https://github.com/tgriesser/knex/blob/887fb5392910ab00f491601ad83383d04b167173/src/util/make-knex.js#L29
 */
export default function createRawFromQueryBuilder(builder: Knex.QueryBuilder, rawSqlQuery: string, bindings?: any): Knex.Raw<unknown>;
