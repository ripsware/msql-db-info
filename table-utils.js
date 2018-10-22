'use strict';


const regexHasId = /(_id)$/gi;
const regexTableName = /(_id)$|^(ms|app|tr)_/gi;

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

function tryParseInt(value, defaultValue) {
    if (isNaN(value)) {
        return defaultValue || value;
    }
    return parseInt(value);
}

function normalizeTableName(name) {
    if (name) {
        return name.replace(regexTableName, '');
    }
    return name;
}

function isColumnId(columnName) {
    return regexHasId.test(columnName);
}

exports.parseType = parseType;
exports.tryParseInt = tryParseInt;
exports.normalizeTableName = normalizeTableName;
exports.columnHasId = isColumnId;
exports.isColumnId = isColumnId;

Object.defineProperty(exports, 'regexTableName', {
    value: regexTableName,
    writable: false
});

Object.defineProperty(exports, 'regexHasId', {
    value: regexHasId,
    writable: false
});
