#!/usr/bin/env node

(function () {
    'use strict';

    const yargs = require('yargs');
    const fs = require('fs');
    const Excel = require('exceljs');
    const mysqlx = require('./mysqlx-utils');
    const mysql = require('mysql');


    const args = yargs
        .option('host', {
            description: 'MySql server host',
            alias: 'h',
            default: 'localhost'
        })
        .option('port', {
            description: 'MySql port',
            default: 3306,
        })
        .option('database', {
            description: 'Database name',
            alias: ['d', 'db'],
            required: true
        })
        .option('user', {
            description: 'MySql Username',
            alias: 'u',
            required: true
        })
        .option('password', {
            description: 'Database password',
            alias: 'p',
            default: '',
            required: false
        })
        .option('path', {
            alias: ['dir'],
            description: 'Save file directory',
            default: './'
        })
        .option('file', {
            alias: ['f'],
            description: 'Save file name'
        })
        .option('xlsx', {
            alias: ['x', 'xls'],
            description: 'Generate data dictionary\n(excel file)',
            default: true,
            type: "boolean"
        })
        .argv;

    if (!(args.database && args.user)) {
        return;
    }

    const dbName = args.database;
    const pool = args.port === 33060 ? new mysqlx.MysqlX(args.user, args.password, dbName, args.host, args.port) : mysql.createPool({
        connectionLimit: 10,
        host: args.host,//'128.199.216.197',
        user: args.user,//'root',
        password: args.password,//'P@ssw0rd',
        database: dbName
    });

    const regexHasId = /(_id)$/gi;
    const regexTableName = /(_id)$|^(ms|app|tr)_/gi;
    const tables = [];
    const tableMap = {};
    const generateXls = args.xlsx;
    const savePath = args.path || './';
    const fileName = args.file || dbName;

    function listAllTable() {
        const qry = 'show table status';
        if(pool.isXconnection){
            return pool.query(qry)
                .then(result => result.result)
                .then(results => {
                    const tables = [];
                    results.forEach(item => {
                        tables.push(item.Name);
                    });
                    return tables;
                });
        }
        return new Promise((resolve, reject) => {
            pool.query(qry, (error, results, columns) => {
                if(error){
                    reject(error);
                }else{
                    const tables = [];
                    results.forEach(item => {
                        tables.push(item.Name);
                    });
                    resolve(tables);
                }
            })
        });
    }

    function describeTable(tableName) {
        const qry = `describe ${tableName}`;
        if(pool.isXconnection){
            return pool.query(qry)
                .then(result => result.result)
                .then(results => {
                    const table = {
                        name: tableName,
                        fields: [],
                        relations: []
                    };
                    results.forEach(row => {
                        table.fields.push(createFieldDefinition(row));
                    });
                    return table;
                });
        }
        return new Promise((resolve, reject) => {
            pool.query(qry, (error, results, columns) => {
                if(error){
                    reject(error);
                }else{
                    const table = {
                        name: tableName,
                        fields: [],
                        relations: []
                    };
                    results.forEach(row => {
                        table.fields.push(createFieldDefinition(row));
                    });
                    resolve(table);
                }
            });
        });
    }

    function createFieldDefinition(row) {
        return {
            name: row.Field,
            type: parseType(row.Type),
            required: row.Null !== 'YES',
            default_value: tryParseInt(row.Default)
        };
    }

    function endConnection() {
        if(pool.isXconnection){
            pool.end().catch(err => {
                if (err) {
                    console.log("Error colosing connection", err)
                }
            });
        }else{
            pool.end(err => {
                if (err) {
                    console.log("Error colosing connection", err)
                }
            });
        }
    }

    function findTable(tableName) {
        if (tableName === 'create_by' || tableName === 'created_by') {
            tableName = 'ms_user';
        }
        if (tableMap[tableName]) {
            return tableMap[tableName];
        }
        tableMap[tableName] = tables.find(table => tableName === table.name);
        if (tableMap[tableName]) {
            return tableMap[tableName];
        }
        delete tableMap[tableName];
        return null;
    }

    function defineRelation() {
        tables.forEach(table => {
            table.fields.forEach(column => {
                if (regexHasId.test(column.name)) {
                    const relatedTable = findTable(column.name.replace(regexHasId, ''));
                    if (relatedTable) {
                        column.related_table = relatedTable.name;
                        table.relations.push({
                            name: normalizeTableName(column.name),
                            table: relatedTable.name,
                            foreign_key: column.name,
                            type: 'many_to_one'
                        });
                        relatedTable.relations.push({
                            name: normalizeTableName(table.name),
                            table: table.name,
                            type: 'one_to_many',
                            external_key: column.name
                        });
                    }
                }
            });
        });
    }

    function parseType(type) {
        if (type) {
            const types = type.replace(/\(/gi, ' (').split(' ');
            const result = {
                type: types.shift()
            };
            if (types.length) {
                result.length = tryParseInt(types.shift().replace(/\(|\)/gi, ''), null);
            }
            return result;
        }
        return type;
    }

    function normalizeTableName(name) {
        if (name) {
            return name.replace(regexTableName, '');
        }
        return name;
    }

    function tryParseInt(value, defaultValue) {
        if (isNaN(value)) {
            return defaultValue || value;
        }
        return parseInt(value);
    }

    function getAllTableDefinition() {
        return listAllTable()
            .then((result) => {
                const promises = [];
                result.forEach(table => promises.push(describeTable(table)));
                return Promise.all(promises);
            })
            .then(tablesDef => {
                endConnection();
                return tablesDef;
            })
    }

    function createWorkbook() {
        // Create excell file
        const workbook = new Excel.stream.xlsx.WorkbookWriter({
            filename: `${savePath}${fileName}.xlsx`,
            useStyles: true,
            useSharedStrings: true
        });

        const sheet = workbook.addWorksheet('Tables');
        let row = 1;
        tables.forEach(table => {
            sheet.getCell(`A${row}`).value = table.name;
            row++;
            sheet.getCell(`A${row}`).value = "Field Name";
            sheet.getCell(`B${row}`).value = "Type";
            sheet.getCell(`C${row}`).value = "Max Length";
            sheet.getCell(`D${row}`).value = "Required";
            sheet.getCell(`E${row}`).value = "Default Value";
            sheet.getCell(`F${row}`).value = "Related Table";
            table.fields.forEach(field => {
                row++;
                sheet.getCell(`A${row}`).value = field.name;
                sheet.getCell(`B${row}`).value = field.type.type;
                sheet.getCell(`C${row}`).value = field.type.length || "";
                sheet.getCell(`D${row}`).value = field.required ? 'YES' : 'NO';
                sheet.getCell(`E${row}`).value = field.default_value || '';
                sheet.getCell(`F${row}`).value = field.related_table || '';
            });
            row += 2;
        });
        workbook.commit();
    }

    function saveTableStructure() {
        const stream = fs.createWriteStream(`${savePath}${fileName}.json`);
        stream.once('open', (fd) => {
            stream.write(JSON.stringify(tables, null, 4));
            stream.end();
        });
    }

    function connect(){
        if(pool.isXconnection){
            return pool.connect()
                .catch(err => {
                    console.error("Connection failed");
                });
        }else{
            return Promise.resolve();
        }
    }

    connect()
        .then(() => {
            return getAllTableDefinition();
        })
        .then(tableResults => {
            tableResults.forEach(table => {
                tableMap[table.name] = table;
                tables.push(table);
            });
        })
        .then(() => {
            // Define relation
            defineRelation();

            // Sort table based-on relation number
            tables.sort((tableA, tableB) => tableA.relations.length - tableB.relations.length);

            // Save table definition to excel file
            if(generateXls){
                createWorkbook();
            }

            // Save structure to json
            saveTableStructure();

            console.log('Done.');
        })
        .catch(err => {
            console.log("Error describing table", err);
            pool.close();
        });
})();

