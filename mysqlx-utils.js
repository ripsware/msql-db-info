const mysqlx = require('@mysql/xdevapi');
const mysql = require('mysql');

class MysqlX {

    constructor(user, password, database, host, port) {
        this.config = {
            user: user,
            password: password,
            schema: database,
            host: host || 'localhost',
            port: port || 33060
        };
        this.session = null;
        this.schema = null;
    }

    get isXconnection(){
        return true;
    }

    connect() {
        return mysqlx.getSession(this.config)
            .then(session => {
                this.session = session;
                return session.getSchema(this.config.schema);
            })
            .then(schema => {
                this.schema = schema;
                return this.session.sql(`use ${schema.getName()}`).execute();
            })
            .then(() => this);
    }

    disconnect(){
        if(this.session){
            return this.session.close();
        }
        return Promise.resolve();
    }

    close(){
        return this.disconnect();
    }

    end(){
        return this.disconnect();
    }

    query(sql){
        return new Promise((resolve, reject) => {
            if (sql && sql.execute) {
                const res = {
                    result: [],
                    columns: [],
                    statistic: null
                };
                sql.execute(result => {
                    res.result.push(result);
                }, col => {
                    res.columns = col
                }).then((statistic) => {
                    const result = [];
                    res.result.forEach(rowData => {
                        const rowResult = {};
                        res.columns.forEach((col, index) => rowResult[col.name] = rowData[index]);
                        result.push(rowResult);
                    });
                    res.result = result;
                    res.statistic = statistic;
                    resolve(res);
                });
            } else if(typeof sql === 'string'){
                this.query(this.session.sql(sql)).then(resolve).catch(reject);
            }else {
                reject({ message: `Please provide executable sql object, got ${typeof sql}` });
            }
        });
    }
}

exports.MysqlX = MysqlX;