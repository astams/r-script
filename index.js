var _ = require("underscore"),
  child_process = require("child_process");

function init(path) {
  var obj = new R(path);
  return _.bindAll(obj, "data", "call", "callSync");
}

//detact pkg 
const PKG_MODE = (process.pkg) ? true : false;

function R(path) {
  this.d = {};
  this.path = path;
  this.idCounter = 0;
  if (PKG_MODE) {
    this.options = {
      env: _.extend({ DIRNAME: process.cwd() + "/R" }, process.env),
      encoding: "utf8"
    };
    this.args = ["--vanilla", process.cwd() + "/R/launch.R"];
  } else {
    this.options = {
      env: _.extend({ DIRNAME: __dirname }, process.env),
      encoding: "utf8"
    };
    this.args = ["--vanilla", __dirname + "/R/launch.R"];
  }
}

R.prototype.data = function () {
  for (var i = 0; i < arguments.length; i++) {
    this.d[++this.idCounter] = arguments[i];
  }
  return this;
};

R.prototype.call = function (_opts, _callback, resolve) {
  var callback = _callback || _opts;
  var opts = _.isFunction(_opts) ? {} : _opts;
  this.options.env.input = JSON.stringify([this.d, this.path, opts]);
  var child = child_process.spawn("Rscript", this.args, this.options);
  child.stderr.on("data", callback);
  //-->
  // child.stdout.on("data", function (d) {
  //   callback(null, JSON.parse(d));
  // });
  //--
  // jw.yi@nosquest.com 2017-09-07 : Modified for IDSysCDT
  //    Fixed JSON parsing error: large data is received in multiple data events
  var data = [];
  child.stdout.on("data", function (d) {
    // console.log("stdout.onData()", d.toString());
    data.push(d);
  });
  child.stdout.on("end", function () {
    // console.log("stdout.onEnd()");
    var d = Buffer.concat(data);
    data = [];
    var result;
    try { result = JSON.parse(d); } catch (e) { result = null; }
    callback(null, result);
  });
  //<--
  child.on('close', (code) => {
    // console.log("onClose()");
    if (resolve) resolve(code);
  })
};

R.prototype.callSync = function (_opts) {
  var opts = _opts || {};
  this.options.env.input = JSON.stringify([this.d, this.path, opts]);
  var child = child_process.spawnSync("Rscript", this.args, this.options);
  if (child.stderr) throw child.stderr;
  return (JSON.parse(child.stdout));
};

module.exports = init;
