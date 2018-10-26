'use strict';

const mysql = require('./mysql');
const tableUtils = require('./table-utils');
const pluralize = require('pluralize');

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
                those.defineClassObject();
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
        if (tableUtils.customTableMap[tableName]) {
            tableName = tableUtils.customTableMap[tableName];
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
                        const relatedTableName = tableUtils.normalizeTableName(tableUtils.normalizeTableName(table.name));
                        if (relatedTable.relations.findIndex(table => table.name === relatedTableName && table.external_key === column.name) === -1){
                            relatedTable.relations.push({
                                name: relatedTableName,
                                table: table.name,
                                type: 'one_to_many',
                                external_key: column.name
                            });
                        }
                    }
                }
            });
        });
    }

    defineClassObject(){
        const those = this;
        those.tables.forEach(table => {
            table.class = {
                name: tableUtils.transformClassName(table.name),
                fields: [],
                relations: []
            };
            table.fields.forEach(field => {
                table.class.fields.push({
                    original: field.name,
                    name: tableUtils.transformFieldName(field.name),
                    type: field.type
                });
            });

            table.relations.forEach(relation => {
                const relationName = tableUtils.transformFieldName(relation.name, relation.type === 'one_to_many');
                if(table.class.relations.findIndex(relation => relation.name === relationName) === -1){
                    table.class.relations.push({
                        original: tableUtils.normalizeTableName(relation.type === 'one_to_many' ? pluralize.plural(relation.name) : relation.name),
                        name: relationName,
                        related_class: tableUtils.transformClassName(relation.table),
                        is_array: relation.type === 'one_to_many',
                        related_key: relation.external_key || relation.foreign_key
                    });
                }
            });
        });
    }


}

exports.SchemaDefinition = SchemaDefinition;