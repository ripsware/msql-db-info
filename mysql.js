'use strict';

const mysqlx = require('./mysqlx-utils');
const mysql = require('mysql');
const tableUtils = require('./table-utils');

class MySql {

    constructor(database, user, password, host, port, connectionLimit) {
        this.user = user || 'root';
        this.password = password || '';
        this.database = database;
        this.host = host || 'localhost';
        this.port = port || 3306;
        this.connectionLimit = connectionLimit || 10;

        this.initializeConnection();
    }

    initializeConnection() {
        if (this.port === 33060) {
            this.isXconnection = true;
            this.pool = new mysqlx.MysqlX(this.user, this.password, this.database, this.host, this.port);
        } else {
            this.isXconnection = false;
            this.pool = mysql.createPool({
                connectionLimit: this.connectionLimit,
                host: this.host,
                user: this.user,
                password: this.password,
                database: this.database
            })
        }
    }

    connect() {
        if (this.isXconnection) {
            return this.pool.connect()
                .catch(err => {
                    console.error("mysql.js", "Connection failed");
                });
        } else {
            return Promise.resolve();
        }
    }

    endConnection() {
        if(!this.pool){
            return;
        }
        if (this.isXconnection) {
            this.pool.end().catch(err => {
                if (err) {
                    console.error("Error colosing connection", err)
                }
            });
        } else {
            this.pool.end(err => {
                if (err) {
                    console.error("Error colosing connection", err)
                }
            });
        }
    }

    close(){
        this.endConnection();
    }

    query(qry) {
        if (this.isXconnection) {
            return this.pool.query(qry)
                .then(res => res.result);
        }
        return new Promise((resolve, reject) => {
            this.pool.query(qry, (error, res, columns) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(res);
                }
            });
        });
    }

    listAllTable() {
        return this.query('show table status')
            .then(results => {
                const tables = [];
                results.forEach(item => {
                    if(item.Comment != 'VIEW'){
                        tables.push(item.Name);
                    }
                });
                return tables;
            });
    }

    describeTable(tableName) {
        return this.query(`describe ${tableName}`)
            .then(results => {
                const table = {
                    name: tableName,
                    fields: [],
                    relations: []
                };
                results.forEach(row => {
                    table.fields.push(this.createFieldDefinition(row));
                });
                return table;
            });
    }

    createFieldDefinition(row) {
        return {
            name: row.Field,
            type: tableUtils.parseType(row.Type),
            required: row.Null !== 'YES',
            default_value: tableUtils.tryParseInt(row.Default)
        };
    }

}

exports.MySql = MySql;