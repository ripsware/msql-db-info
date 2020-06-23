'use strict';

const {Pool} = require('pg');
const tableUtils = require('./table-utils');

class Postgres {

    constructor(database, user, password, host, port, connectionLimit) {
        this.user = user || 'root';
        this.password = password || '';
        this.database = database;
        this.host = host || 'localhost';
        this.port = port || 3211;
        this.connectionLimit = connectionLimit || 10;
        this.initializeConnection();
    }

    initializeConnection() {
        this.pool = new Pool({
            user: this.user,
            host: this.host,
            database: this.database,
            password: this.password,
            port: this.port,
            max: this.connectionLimit
        })
    }

    connect() {
        if (!this.pool) {
            this.initializeConnection();
        }
        return this.pool.connect();
    }

    endConnection() {
        if (this.pool) {
            this.pool.end();
        }
    }

    close() {
        this.endConnection();
    }

    async query(sql, param) {
        if (sql) {
            const client = await this.connect();
            return await client.query(sql, param || []);
        }
        return null;
    }

    listAllTable() {
        return this.query('SELECT tablename as name FROM pg_catalog.pg_tables where schemaname = $1', [this.database]);
    }

    async describeTable(tableName) {
        const fields = await this.query('select column_name, data_type, character_maximum_length, is_nullable, column_default from INFORMATION_SCHEMA.COLUMNS where table_name = $1', [tableName]);
        const table = {
            name: tableName,
            fields: fields.map(field => this.createFieldDefinition(field)).filter(item => item),
            relations: []
        };
        return table;
    }

    createFieldDefinition(row) {
        if (row) {
            return {
                name: row.column_name,
                type: tableUtils.parseType(row.data_type),
                required: row.is_nullable !== 'NO',
                default_value: tableUtils.tryParseInt(row.column_default)
            };
        }
        return null;
    }

}

exports.Postgres = Postgres;
