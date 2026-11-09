// A shell's global NODE_ENV must not silently change the production start mode.
process.env.NODE_ENV = "production";
require("../dist/server.js");
