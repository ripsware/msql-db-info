"use strict";

const caseUtil = require("case");
const pluralize = require("pluralize");

const regexHasId = /(_id)$/gi;
const regexTableName = /(_id)$|^(ms|app|tr)_/gi;
const replaceTemplate = {
  "1": "satu",
  "2": "dua",
  "3": "tiga",
  "4": "empat",
  "5": "lima",
  "6": "enam",
  "7": "tujuh",
  "8": "delapan"
};
const customTableMap = {
  create_by: "user",
  create_by_id: "user",
  created_by: "user",
  created_by_id: "user",
  scale_id: "product_scale",
  scale: "product_scale",
  product_scale: "product_scale",
  product_scale_id: "product_scale",
  inherited_from_id: "product_scale",
  inherited_from: "product_scale",
  operator_id: "user",
  operator: "user",
  update_by: "user",
  update_by_id: "user",
  updated_by: "user",
  updated_by_id: "user",
  approved_by: "user",
  approved_by_id: "user",
  approve_by: "user",
  approve_by_id: "user",
  rejected_by: "user",
  rejected_by_id: "user",
  reject_by: "user",
  reject_by_id: "user",
  revised_by: "user",
  revised_by_id: "user",
  approved_by_id: 'user',
  approved_by_id: 'user',
  rejected_by_id: 'user',
  rejected_by_id: 'user',
  checked_by_id: 'user',
  checked_by_id: 'user',
  approved_by: 'user',
  approved_by_id: 'user',
  rejected_by: 'user',
  rejected_by_id: 'user',
  checked_by: 'user',
  checked_by_id: 'user',
  banner_image_file_id: 'file',
  banner_image_file_id: 'file',
  image_file_id: 'file',
  image_file_id: 'file',
  checked_by: 'user',
  checked_by_id: 'user',
  banner_image_file: 'file',
  banner_image_file_id: 'file',
  image_file: 'file',
  image_file_id: 'file',

  parent_id: (columnName, tableName) => tableName,
  parent: (columnName, tableName) => tableName,
};

function parseType(type) {
  if (type) {
    const types = type.replace(/\(/gi, " (").split(" ");
    const result = {
      type: types.shift()
    };
    if (types.length) {
      result.length = tryParseInt(types.shift().replace(/\(|\)/gi, ""), null);
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

function replace(name) {
  if (name && /_\d$/gi.test(name)) {
    const key = /\d/gi.exec(name)[0];
    if (replaceTemplate[key]) {
      return name.replace(
        new RegExp(`_${key}$`, "gi"),
        `_${replaceTemplate[key]}`
      );
    }
  }
  return name;
}

function normalizeTableName(name) {
  if (name) {
    return replace(name).replace(regexTableName, "");
  }
  return name;
}

function isColumnId(columnName) {
  return regexHasId.test(columnName);
}

function transformClassName(tableName) {
  if (tableName) {
    return caseUtil.pascal(normalizeTableName(tableName));
  }
  return tableName;
}

function transformFieldName(columnName, isPlural) {
  if (columnName) {
    if (isPlural) {
      return caseUtil.camel(pluralize.plural(replace(columnName)));
    }
    return caseUtil.camel(replace(columnName));
  }
  return columnName;
}

exports.parseType = parseType;
exports.tryParseInt = tryParseInt;
exports.normalizeTableName = normalizeTableName;
exports.columnHasId = isColumnId;
exports.isColumnId = isColumnId;
exports.transformClassName = transformClassName;
exports.transformFieldName = transformFieldName;

Object.defineProperty(exports, "regexTableName", {
  value: regexTableName,
  writable: false
});

Object.defineProperty(exports, "regexHasId", {
  value: regexHasId,
  writable: false
});

Object.defineProperty(exports, "customTableMap", {
  value: customTableMap,
  writable: false
});
