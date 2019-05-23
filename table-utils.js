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
  create_by: "ms_user",
  created_by: "ms_user",
  update_by: "ms_user",
  updated_by: "ms_user",
  approved_by: "ms_user",
  approve_by: "ms_user",
  rejected_by: "ms_user",
  reject_by: "ms_user",
  revised_by: "ms_user",
  next_workflow_stage: "ms_workflow_stage",
  prev_workflow_stage: "ms_workflow_stage",
  reject_workflow_stage: "ms_workflow_stage",
  reference_workflow_stage: "ms_workflow_stage",
  reference_workflow_stage_id: "ms_workflow_stage",
  revised_workflow_stage_id: "ms_workflow_stage",
  revised_workflow_stage: "ms_workflow_stage",
  previous_workflow_data_id: "app_workflow_data",
  previous_workflow_data: "app_workflow_data",
  next_question_id: "ms_question",
  next_question: "ms_question",
  reference_workflow_stage_id: 'ms_workflow_stage',
  reference_workflow_stage: 'ms_workflow_stage',
  revised_by_id: 'ms_user',
  revised_by: 'ms_user',
  revised_workflow_stage_id: 'ms_workflow_stage',
  revised_workflow_stage: 'ms_workflow_stage',
  previous_workflow_data_id: 'app_workflow_data',
  previous_workflow_data: 'app_workflow_data',

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
