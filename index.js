#!/usr/bin/env node

(function () {
    'use strict';

    const yargs = require('yargs');
    const fs = require('fs');
    const Excel = require('exceljs');
    const mysql = require('./mysql');
    const schemaDefinition = require('./schema-definition');

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
    const client = new mysql.MySql(dbName, args.user, args.password, args.host, args.port);
    const schemaDef = new schemaDefinition.SchemaDefinition(client);

    const tables = [];
    const generateXls = args.xlsx;
    const savePath = args.path || './';
    const fileName = args.file || dbName;

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

    schemaDef.reloadTableDeffinition()
        .then((tableResults) => {
            tables.push(...tableResults);

            // Sort table based-on relation number
            tables.sort((tableA, tableB) => tableA.relations.length - tableB.relations.length);

            // Save table definition to excel file
            if (generateXls) {
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

