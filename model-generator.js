#!/usr/bin/env node

(() => {
  ("use strict");

  const yargs = require("yargs");
  const caseUtil = require("case");
  const handleBars = require("handlebars");
  const fs = require("fs");

  const args = yargs
    .option("action", {
      description:
        "Action or presets name. available presets: eloquent-model, api-doc.",
      alias: ["a"],
      default: "eloquent-model"
    })
    .option("eloquent-model", {
      description: "Generate eloquent model",
      default: false,
      alias: ["model"],
      type: "boolean"
    })
    .option("api-doc", {
      description: "Generate api doc",
      default: false,
      alias: ["api"],
      type: "boolean"
    })
    .option("model-interface", {
      description: "Generate typescript model interface",
      default: false,
      alias: ["interface"],
      type: "boolean"
    })
    .option("dart-model", {
      description: "Generate dart class model",
      default: false,
      alias: ["dart-model"],
      type: "boolean"
    })
    .option("namespace", {
      description: "Code namespace or packafe",
      default: 'ripsware',
      alias: ['ns', 'package'],
      type: 'string'
    })
    .option("presets", {
      description: "Presets file in json format",
      default: "./presets/model-generator.json",
      alias: ["p"]
    })
    .option("template", {
      description: "Template file in json format",
      alias: ["t"]
    })
    .option("output", {
      description: "Output path",
      default: "./",
      alias: ["o"]
    }).argv;

  if (!args.action && !args.eloquentModel && !args.apiDoc) {
    return;
  }

  if (args.eloquentModel) {
    args.action = "eloquent-model";
  } else if (args.apiDoc) {
    args.action = "api-doc";
  } else if (args.modelInterface) {
    args.action = "model-interface";
  } else if (args.dartModel) {
    args.action = "dart-model";
  }

  const currentPresetName = args.action; //"eloquent-model"; // "api-doc";
  const presets = require(args.presets || "./presets/model-generator.json");
  const currentPreset = currentPresetName ? presets[currentPresetName] : null;
  const namespace = args.namespace || 'ripsware';
  const dataPath = args.template;
  const templatePath = getConfig(
    "template_path",
    "./templates/php.eloquent.model.php.hbs"
  );
  const outDir = args.output;
  const outputExt = getConfig("ouput_ext", null);

  const command = getConfig("command", "models");

  function getConfig(name, defaultValue) {
    if (currentPreset && currentPreset[name]) {
      return currentPreset[name];
    }
    return defaultValue;
  }

  function parseOutputFileExtension(templateFile) {
    if (outputExt) {
      return outputExt;
    }
    if (templateFile) {
      return `.${templateFile
        .replace(/.hbs$/gi, "")
        .split(".")
        .pop()}`;
    }
    return ".txt";
  }

  function loadTemplate(templatePath) {
    return new Promise((resolve, reject) => {
      fs.exists(templatePath, exists => {
        if (exists) {
          fs.readFile(templatePath, "utf-8", function (error, source) {
            if (error) {
              reject(error);
            } else {
              resolve(source);
            }
          });
        } else {
          reject(`File ${templatePath} not found`);
        }
      });
    });
  }

  function saveFile(filePath, content) {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, err => {
        if (err) {
          reject(err);
        } else {
          resolve(filePath);
        }
      });
    });
  }

  function validateDir(outputDir) {
    return new Promise((resolve, reject) => {
      fs.exists(outputDir, exists => {
        if (exists) {
          resolve(outputDir);
        } else {
          fs.mkdir(outputDir, err => {
            if (err) {
              reject(err);
            } else {
              resolve(outputDir);
            }
          });
        }
      });
    });
  }

  function loadClassData(path) {
    return new Promise((resolve, reject) => {
      fs.exists(path, exists => {
        if (exists) {
          resolve(require(path));
        } else {
          reject(`Class definition file ${path} not found`);
        }
      });
    });
  }

  function timeout(interval) {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, interval);
    });
  }

  function queue(promises) {
    return new Promise((resolve, reject) => {
      if (promises && promises.length) {
        const results = [];
        let basePromise = Promise.resolve(-1);
        promises.forEach(promise => {
          basePromise = basePromise
            .then(res => {
              if (res !== -1) {
                results.push(res);
              }
              return promise;
            })
            .catch(err => reject(err));
        });
        basePromise
          .then(result => {
            results.push(result);
            resolve(results);
          })
          .catch(err => reject(err));
      } else {
        resolve([]);
      }
    });
  }

  function initOutput() {
    return validateDir(outDir)
      .then(() => loadTemplate(templatePath))
      .then(source =>
        loadClassData(dataPath).then(data => {
          const extension = parseOutputFileExtension(templatePath);
          const outputDir = `${outDir}${outDir.endsWith("/") ? "" : "/"}`;
          const template = handleBars.compile(source);
          return { data, template, extension, outputDir };
        })
      );
  }

  function generateModels() {
    return initOutput()
      .then(result => {
        const { data, template, extension, outputDir } = result;
        const promises = [];
        data.forEach((table, i) => {
          promises.push(
            timeout(i * 10).then(() =>
              saveFile(
                `${outputDir}${table.class.name}${extension}`,
                template(table)
              )
            )
          );
        });
        return Promise.all(promises);
      })
      .then(results => console.log("done\n", results));
  }

  function generateDoc() {
    return initOutput().then(result => {
      const { data, template, extension, outputDir } = result;
      return saveFile(
        `${outputDir}api-doc${extension}`,
        template({ structures: data })
      );
    });
  }

  function generateInterface() {
    return initOutput().then(result => {
      const { data, template, extension, outputDir } = result;
      const typeMap = {
        varchar: 'string',
        text: 'string',
        json: 'string',
        enum: 'string',
        int: 'number',
        double: 'number',
        decimal: 'number',
        tinyint: 'number',
        datetime: 'number | string | Date',
        timestamp: 'number | string | Date',
        date: 'number | string | Date',
      };
      const newData = data.map(item => {
        item.class.fields.map(field => {
          if (field.type && field.type.type) {
            if (field.type.type === 'enum') {
              Object.assign(field.type, { compiled: field.type.length.toString().replace(/,/gi, ' | ') });
            } else {
              Object.assign(field.type, { compiled: typeMap[field.type.type] || field.type.type });
            }
          }
          return field;
        });
        return item;
      });
      return saveFile(
        `${outputDir}interfaces${extension}`,
        template({ structures: newData })
      );
    });
  }

  function generateDartModel() {
    return initOutput().then(result => {
      const { data, template, extension, outputDir } = result;
      const typeMap = {
        varchar: 'String',
        text: 'String',
        json: 'String',
        enum: 'String',
        int: 'int',
        double: 'double',
        decimal: 'double',
        tinyint: 'int',
        datetime: 'DateTime',
        timestamp: 'DateTime',
        date: 'DateTime',
      };
      const newData = data.map(item => {
        item.class.fields.map(field => {
          if (field.type && field.type.type) {
            Object.assign(field.type, { compiled: typeMap[field.type.type] || field.type.type });
          }
          return field;
        });
        return item;
      });
      const promises = [];
      data.forEach((table, i) => {
        const requireId = !table.class.fields.find(field => field.name === 'id');
        table.class.imports = [];
        table.class.relations.forEach(item => {
          const name = caseUtil.snake(item.related_class);
          if(table.class.imports.findIndex(it => it.name === name) === -1){
            table.class.imports.push({name});
          }
        });
        promises.push(
          timeout(i * 10).then(() =>
            saveFile(
              `${outputDir}${table.name}${extension}`,
              template(Object.assign(table, {package: namespace, requireId}))
            )
          )
        );
      });
      return Promise.all(promises);
    });
  }

  // Run the command
  let promise = Promise.resolve("Please select a command");
  switch (command) {
    case "models":
      promise = generateModels();
      break;
    case "doc":
    case "documentation":
      promise = generateDoc();
      break;
    case "interface":
    case "model-interface":
      promise = generateInterface();
      break;
    case "dart-model":
      promise = generateDartModel();
      break;
  }
  promise.then(res => console.log(res));
})();
