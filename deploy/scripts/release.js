const path = require("path");
const program = require("commander");
program
  .option(
    "-s --strategy <compiler>",
    "加密打包等 逗号隔开",
    "obfuscate,bytenode"
  )
  .option("-p --project <string>", "项目", "一键报警")
  .option("-d --deploy <string>", "发布类型", "srcode")
  .option("-c --config <string>", "多个配置", "./config.default.js")
  .option("-o --output <directory>", "输出文件夹", "./deploy/release")
  .option("-n --name <filename>", "输出文件名称", "temp");
program.parse(process.argv);
const deploys = {
  windows: "windows", // 包含 script_windows,vendor, srcode
  srcode: "srcode", // 不包含deploy中的数据只有srcode
};
// 添加获取时间年月日的方法
Date.prototype.format = function (fmt) {
  var o = {
    "M+": this.getMonth() + 1, //月份
    "d+": this.getDate(), //日
    "h+": this.getHours(), //小时
    "m+": this.getMinutes(), //分
    "s+": this.getSeconds(), //秒
    "q+": Math.floor((this.getMonth() + 3) / 3), //季度
    S: this.getMilliseconds(), //毫秒
  };
  if (/(y+)/.test(fmt)) {
    fmt = fmt.replace(
      RegExp.$1,
      (this.getFullYear() + "").substr(4 - RegExp.$1.length)
    );
  }
  for (var k in o) {
    if (new RegExp("(" + k + ")").test(fmt)) {
      fmt = fmt.replace(
        RegExp.$1,
        RegExp.$1.length == 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length)
      );
    }
  }
  return fmt;
};
const glob = require("glob");
const fs = require("fs-extra");
const archiver = require("archiver");
const { exec } = require("child_process");
var log4js = require("log4js");
var logger = log4js.getLogger();
const bytenode = require("bytenode");
logger.level = "info";
/** 配置文件 */
let options = program.opts();
// 可配置多个配置文件
const configPath = path.join(__dirname, options.config);
if (fs.existsSync(configPath)) {
  const moreOptions = require(configPath);
  options = { ...options, ...moreOptions };
} else {
  // 全部的
  const from = {
    pattern: "**/*",
    opts: { ignore: ["**/node_modules/**", "**/release/**", "**/deploy/**"] },
  };
  const bytenodeOpts = {
    pattern: "**/*.@(js)",
    opts: {
      ignore: ["**/config/**", "**/node_modules/**", ...from.opts.ignore],
    },
    to: "./deploy/bytenode",
  };
  const obfuscateOpts = {
    pattern: "**/*.@(js)",
    opts: {
      ignore: ["**/config/**", "**/node_modules/**", ...from.opts.ignore],
    },
    to: "./deploy/obfuscated",
  };
  options = { ...options, from, bytenodeOpts, obfuscateOpts };
}
options.strategy = options.strategy.split(",");
options.shouldObfuscate = options.strategy.some(
  (handler) => handler === "obfuscate"
);
options.shouldBytenode = options.strategy.some(
  (handler) => handler === "bytenode"
);
logger.info("开始打包 打包参数:%o", options);
// 1 打包
// 2 bytenode
// 3 obfuscator
// input
// output

// 创建archive
async function initArchiver(
  to = { path: options.output, name: `${options.name}_${options.deploy}` },
  method = { name: "zip", options: { zlib: { level: 9 } } }
) {
  const { path: toPath, name: toName } = to;
  if (!fs.existsSync(toPath)) {
    await fs.mkdir(toPath, { recursive: true });
  }
  const { name: methodName, options } = method;
  // 文件后缀
  const fileExtensions = {
    zip: ".zip",
    gz: ".tar.gz",
  };
  const output = path.resolve(
    toPath,
    `${toName}${new Date().format("yyyyMMdd_hh_mm_ss")}${
      fileExtensions[methodName]
    }`
  );
  if (fs.existsSync(output)) {
  }
  const outputStream = fs.createWriteStream(output);
  const archive = archiver(methodName);
  archive.pipe(outputStream);
  return archive;
}

async function getFiles(pattern, opts) {
  logger.info("getFiles pattern", pattern, opts.ignore);
  const promise = new Promise((resolve, reject) => {
    glob(pattern, opts, (err, files) => {
      if (err) return reject(err);
      resolve(files);
    });
  });
  return await promise;
}

// 二进制化代码
async function compileByBytenode(
  pattern = "**/*.@(js)",
  opts = { ignore: ["**/r.js", "**/node_modules/**"] },
  to
) {
  const jsFiles = await getFiles(pattern, opts);
  logger.info("开始 bytenode%o", jsFiles);
  const { path: toPath = "./deploy/bytenode/" } = to || {};
  const compiledPaths = [];
  if (!jsFiles) {
    logger.info("compileByBytenode");
    return compiledPaths;
  }
  for (filename of jsFiles) {
    const output = `${toPath}${filename}c`;
    if (!fs.existsSync(output)) {
      const outputs = output.split("/");
      outputs.pop();
      const dir = outputs.join("/");
      if (!fs.existsSync(dir)) await fs.mkdir(dir, { recursive: true });
      // await fs.writeFile(output);
    }
    await bytenode.compileFile({ filename, output });
    compiledPaths.push(output);
  }
  return compiledPaths;
}

// 混淆
async function obfuscate(
  pattern = "**/*.@(js)",
  opts = { ignore: ["**/r.js", "**/node_modules/**"] },
  to
) {
  const jsFiles = await getFiles(pattern, opts);
  logger.info("开始 obfuscate%o", jsFiles);
  const { path: toPath = "./deploy/obfuscated" } = to || {};
  const compiledPaths = [];
  if (!jsFiles) {
    logger.info("compileByBytenode");
    return compiledPaths;
  }
  for (filename of jsFiles) {
    const output = `${toPath}/${filename}`;
    if (!fs.existsSync(output)) {
      const outputs = output.split("/");
      outputs.pop();
      const dir = outputs.join("/");
      if (!fs.existsSync(dir)) await fs.mkdir(dir, { recursive: true });
      // await fs.writeFile(output);
    }
    const command = `javascript-obfuscator ${filename} --output ${output}`;
    await new Promise((resolve) =>
      exec(command, (err) => {
        if (err) {
          logger.error(err);
        }
        resolve();
      })
    );
    compiledPaths.push(output);
  }
  return compiledPaths;
}

// 删除临时文件
async function removeTemp() {
  if (fs.existsSync(path.resolve(options.obfuscateOpts.to))) {
    await new Promise((resolve) => {
      fs.remove(
        path.resolve(options.obfuscateOpts.to),
        // {
        //     recursive: true,
        // },
        (err) => {
          if (err) {
            logger.error(`删除${options.obfuscateOpts.to}`, err);
            console.log(`<<<<01-25 14:09:51>>>>⬇️\n✨`, `arguments`, arguments);
          }
          resolve();
        }
      );
    });
  } else {
    logger.info("混淆临时文件不存在", options.obfuscateOpts.to);
  }
  if (fs.existsSync(path.resolve(options.bytenodeOpts.to))) {
    await new Promise((resolve) => {
      fs.remove(
        path.resolve(options.bytenodeOpts.to),
        // {
        //     recursive: true,
        // },
        (err) => {
          if (err) {
            logger.error(`删除${options.bytenodeOpts.to}`, err);
          }
          console.log(`<<<<01-25 14:09:51>>>>⬇️\n✨`, `arguments`, arguments);
          resolve();
        }
      );
    });
  } else {
    logger.info("bytenode临时文件不存在", options.bytenodeOpts.to);
  }

  logger.info("删除临时文件完毕");
}

(async function () {
  try {
    await removeTemp();
    const { from, bytenodeOpts, obfuscateOpts } = options; // 全部的

    const archive = await initArchiver();
    let obfuscatedFiles = [],
      bytenodeFiles = [];
    /* obfuscatedOpts */
    if (options.shouldObfuscate)
      obfuscatedFiles = await obfuscate(
        obfuscateOpts.pattern,
        obfuscateOpts.opts,
        obfuscateOpts.to
      );
    logger.info(obfuscatedFiles);
    /* bytenode的 */
    if (options.shouldBytenode)
      bytenodeFiles = await compileByBytenode(
        bytenodeOpts.pattern,
        bytenodeOpts.opts,
        bytenodeOpts.to
      );
    logger.info(bytenodeFiles);
    console.log(
      `<<<<02-22 14:39:10>>>>⬇️\n✨`,
      `options.shouldBytenode`,
      options.shouldBytenode
    );
    /* all */
    const allFiles = await getFiles(from.pattern, from.opts);

    const files = allFiles.filter((file) => {
      return fs.statSync(file).isFile();
    });
    files.forEach((file) => {
      if (file.indexOf(".env") !== -1) {
        console.log(`<<<<02-22 14:17:26>>>>⬇️\n✨`, `file`, file);
      }
    });

    logger.info("所有打包文件%o", files);
    // 文件
    let prefix = "";
    // windows 压缩包
    if (options.deploy === deploys.windows) {
      prefix = "srcode";
      archive.directory("./deploy/script_windows", "script_windows");
      // 仅 windows 可以vendor,srcode不能有vendor
      if (options.vendor) {
        options.vendor.forEach((file) => {
          archive.file(`./deploy/vendor/${file}`, { name: `/vender/${file}` });
        });
      }
    }
    files.forEach(async (file) => {
      if (file.endsWith(".js")) {
        logger.debug("isJsFile", file);
        if (file.endsWith(`config/config.${options.project}.js`)) {
          archive.file(file, {
            name: file.replace(`.${options.project}`, ""),
            prefix,
          });
          return;
        }
        if (options.shouldBytenode) {
          const bytenodeFile = (bytenodeFiles || []).find((bFile) => {
            return bFile === bytenodeOpts.to + "/" + file + "c";
          });
          if (bytenodeFile) {
            logger.debug(`bytenodeFile`, bytenodeFile, file);
            archive.file(bytenodeFile, { name: file + "c", prefix });
            return;
          }
        }
        if (options.shouldObfuscate) {
          const obfuscatedFile = (obfuscatedFiles || []).find(
            (oFile) => oFile === obfuscateOpts.to + "/" + file
          );
          if (obfuscatedFile) {
            logger.debug(`obfuscatedFile`, obfuscatedFile, file);
            archive.file(obfuscatedFile, { name: file, prefix });
            return;
          }
        }
      }
      await archive.file(file, { prefix });
    });

    await archive.finalize();
    // 压缩完毕
    logger.info("压缩完毕");
  } catch (err) {
    console.error("err 打包失败", err);
  } finally {
    // TODO 删除临时文件
    await removeTemp();
  }
})();
