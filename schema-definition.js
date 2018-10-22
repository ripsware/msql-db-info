'use strict';

const mysql = require('./mysql');
const tableUtils = require('./table-utils');

class SchemaDefinition {

    constructor(connection) {
        this.tables = [];
        this.tableMap = {};
        if (connection instanceof mysql.MySql) {
            this.connection = connection;
        } else {
            this.connection = null;
            throw "the connection parameter should be instance of MySql";
        }
    }

    reloadTableDeffinition() {
        const those = this;
        return those.connection.connect()
            .then(() => {
                return those.loadAllTableDefinition();
            })
            .then(results => {
                those.tableMap = {};
                those.tables = [];
                results.forEach(table => {
                    those.tableMap[table.name] = table;
                    those.tables.push(table);
                });
                return those.tables;
            })
            .then((tables) => {
                those.defineRelation();
                return tables;
            });
    }

    loadAllTableDefinition() {
        const those = this;
        return those.connection.listAllTable()
            .then((result) => {
                const promises = [];
                result.forEach(table => promises.push(those.connection.describeTable(table)));
                return Promise.all(promises);
            })
            .then(tablesDef => {
                those.connection.close();
                return tablesDef;
            });
    }

    findTable(tableName) {
        if (tableName === 'create_by' || tableName === 'created_by') {
            tableName = 'ms_user';
        }
        if (this.tableMap[tableName]) {
            return this.tableMap[tableName];
        }
        this.tableMap[tableName] = this.tables.find(table => tableName === table.name);
        if (this.tableMap[tableName]) {
            return this.tableMap[tableName];
        }
        delete this.tableMap[tableName];
        return null;
    }

    defineRelation() {
        const those = this;
        those.tables.forEach(table => {
            table.fields.forEach(column => {
                if (tableUtils.isColumnId(column.name)) {
                    const relatedTable = those.findTable(column.name.replace(tableUtils.regexHasId, ''));
                    if (relatedTable) {
                        column.related_table = relatedTable.name;
                        table.relations.push({
                            name: tableUtils.normalizeTableName(column.name),
                            table: relatedTable.name,
                            foreign_key: column.name,
                            type: 'many_to_one'
                        });
                        relatedTable.relations.push({
                            name: tableUtils.normalizeTableName(table.name),
                            table: table.name,
                            type: 'one_to_many',
                            external_key: column.name
                        });
                    }
                }
            });
        });
    }


}

exports.SchemaDefinition = SchemaDefinition;