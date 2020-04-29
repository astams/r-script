const _ = require("underscore");
const child_process = require("child_process");

const Path = require("path");

function init(path, rBinPath) {
  const obj = new R(path, rBinPath);
  return _.bindAll(obj, "data", "call", "callSync");
}

function R(path, rBinPath) {
  this.d = {};
  this.path = path;
  this.rBinPath = rBinPath;
  this.idCounter = 0;
  let DIRNAME, rSrcDir;
  if (process.pkg) {
    DIRNAME = Path.join(process.cwd(), "build");
    rSrcDir = DIRNAME;
  } else {
    DIRNAME = __dirname;
    rSrcDir = Path.join(__dirname, "R");
  }
  this.options = {
    env: _.extend({ DIRNAME }, process.env),
    encoding: "utf8"
  };
  this.args = ["--vanilla", Path.join(rSrcDir, "launch.R")];
}

R.prototype.data = function () {
  for (let i = 0; i < arguments.length; ++i) {
    ++this.idCounter;
    this.d[this.idCounter] = arguments[i];
  }
  return this;
};

R.prototype.call = function (_opts, _callback) {
  const callback = _callback || _opts;
  const opts = _.isFunction(_opts) ? {} : _opts;

  this.options.env.input = JSON.stringify([this.d, this.path, opts]);
  this.options.env.LANG = "en_US.UTF-8";
  // console.log("rBinPath=", this.rBinPath, "\nargs=", this.args, "\noptions=", this.options);
  let child;
  if (this.rBinPath) {
    this.options.maxBuffer = 64 * 1024 * 1024;
    child = child_process.execFile(Path.join(this.rBinPath, "Rscript"), this.args, this.options,
      (error) => {
        if (error) {
          // console.log("error=", error);
          callback(error, null, null);
        }
      });
  } else {
    child = child_process.spawn("Rscript", this.args, this.options);
  }

  const errors = [];
  child.stderr.on("data", function (err) {
    // console.log("stderr.onData() err=", err.toString());
    errors.push(err);
  });
  child.stderr.on("end", function () {
    // console.log("stderr.onEnd()");
    if (0 < errors.length) {
      callback(null, errors, null);
    }
  });

  const data = [];
  child.stdout.on("data", function (d) {
    // console.log("stdout.onData() d=", d.toString());
    data.push(new Buffer(d));
  });
  child.stdout.on("end", function () {
    // console.log("stdout.onEnd()");
    const d = Buffer.concat(data);
    try {
      callback(null, null, JSON.parse(d));
    } catch (e) {
      callback(e, null, null);
    }
  });

  child.on("close", (code) => {
    // console.log("onClose() code=", code);
    if (code) {
      callback(code, null, null);
    }
  });
};  // call

R.prototype.callSync = function (_opts) {
  const opts = _opts || {};
  this.options.env.input = JSON.stringify([this.d, this.path, opts]);
  const child = child_process.spawnSync("Rscript", this.args, this.options);
  if (child.stderr) { throw child.stderr; }
  return JSON.parse(child.stdout);
};

module.exports = init;
