CodeEngine lib
======================================

This is the core library for [CodeEngine](https://engine.codes/). It exports the `CodeEngine` class, which manages plugins, worker threads, events, builds, and watching functionality.

> **NOTE:** This is an **internal library** that is only intended to be used by CodeEngine. Using it outside of CodeEngine is discouraged. Use the [code-engine npm package](https://www.npmjs.com/package/code-engine) instead.

### Table of Contents

- [CodeEngine class](#codeengine-class)
- [Static members](#static-members)
- [Properties](#properties)
- [Methods](#methods)
- [Events](#events)



`CodeEngine` class
-------------------------------
This is the programmatic interface to CodeEngine.  Multiple CodeEngine instances can co-exist in the same process. Each instance manages its own plugins, worker threads, events builds, and watches.

```javascript
import CodeEngine from "@code-engine/lib";

// Create a new CodeEngine instance with the default config
let engine = new CodeEngine();

try {
  // Add some plugins
  await engine.use(plugin1, plugin2, plugin3);

  // Clean the destination directory
  await engine.clean();

  // Run a build
  let summary = await engine.build();

  // Show the results
  console.log(`${summary.output.fileCount} files were created`);
}
finally {
  // Safely dispose the instance
  await engine.dispose();
}
```


### `CodeEngine` constructor
The constructor accepts an optional [`Config` object](src/config.ts).

```javascript
import CodeEngine from "@code-engine/lib";

// Create a new CodeEngine instance with a custom config
let engine = new CodeEngine({
  concurrency: 20,
  watchDelay: 1000,
  debug: true,
});
```

|Config setting  |Type    |Default          |Description
|----------------|--------|-----------------|---------------------------------------------------
|`cwd`           |string  |`process.cwd()`  |The directory used to resolve all relative paths.
|`concurrency`   |number  |The number of CPU cores available |The number of worker threads that CodeEngine should use to process files.
|`watchDelay`    |number  |300 milliseconds |The time (in milliseconds) to wait after a `Plugin.watch()` method indicates a file change before starting a build. This allows multiple files that are changed together to all be re-built together.
|`dev`           |boolean |false, unless the NODE_ENV environment variable is set to "development" |Indicates whether CodeEngine should run in local development mode. When `true`, many plugins will generate files that are un-minified, un-obfuscated, and may contain references to localhost.
|`debug`         |boolean |false, unless the DEBUG environment variable is set to a non-empty value |Indicates whether CodeEngine is running in debug mode, which enables additional logging and error stack traces.



Static members
-------------------------------

### `CodeEngine.instances`
This static class property is an array of all `CodeEngine` instances that have been created and not yet disposed.  You can call [dispose()](#codeenginedispose) on a single instance to dispose it, or [`CodeEngine.disposeAll()`](#codeenginedisposeall) to dispose all instances.

```javascript
import CodeEngine from "@code-engine/lib";

let engine1 = new CodeEngine();
let engine2 = new CodeEngine();
let engine3 = new CodeEngine();

console.log(`There are ${CodeEngine.instances.length} CodeEngine instances`);
```


### `CodeEngine.disposeAll()`
This static class method disposes all `CodeEngine` instances (see [dispose()](#codeenginedispose)). After calling this method, the existing CodeEngine instance are no longer usable.

```javascript
import CodeEngine from "@code-engine/lib";

let engine1 = new CodeEngine();
let engine2 = new CodeEngine();
let engine3 = new CodeEngine();

// Dispose all three instances
await CodeEngine.disposeAll();
```



Properties
-------------------------------

### `CodeEngine.isDisposed`
Indicates whether the [`dispose()` method](#codeenginedispose) has been called. Once disposed, a `CodeEngine` instance is no longer usable.

```javascript
import CodeEngine from "@code-engine/lib";

let engine = new CodeEngine();
console.log(engine.isDisposed);     // false

await engine.dispose();
console.log(engine.isDisposed);     // true
```



Methods
-------------------------------

### `CodeEngine.use(...plugins)`
Adds one or more [CodeEngine plugins](https://github.com/CodeEngineOrg/code-engine-types#types).

```javascript
import CodeEngine from "@code-engine/lib";
let engine = new CodeEngine();

// Add a single plugin
await engine.use(somePlugin);

// Add multiple plugins
await engine.use(plugin1, plugin2, plugin3);
```


### `CodeEngine.clean()`
Deletes any previous build output from the destination(s).

```javascript
import CodeEngine from "@code-engine/lib";
let engine = new CodeEngine();

// Add some plugins
await engine.use(plugin1, plugin2, plugin3);

// Clean the destination(s)
await engine.clean();
```


### `CodeEngine.build()`
Runs a full build of all source files. Returns a [`BuildSummary` object](https://github.com/CodeEngineOrg/code-engine-types/blob/master/src/build-summary.d.ts) with information about the build.

```javascript
import CodeEngine from "@code-engine/lib";
let engine = new CodeEngine();

// Add some plugins
await engine.use(plugin1, plugin2, plugin3);

// Run a build
let summary = await engine.build();

// Show the results
console.log(`${summary.output.fileCount} files were created`);
```


### `CodeEngine.watch()`
Watches source files for changes and runs incremental re-builds whenever changes are detected.

```javascript
import CodeEngine from "@code-engine/lib";
let engine = new CodeEngine();

// Add some plugins
await engine.use(plugin1, plugin2, plugin3);

// Run a full build first
await engine.build();

// Start watching for changes and do incremental builds
engine.watch();

engine.on("buildStarting", ({ changedFiles }) => {
  console.log(`${changedFiles.length} files were changed. Rebuilding...`);
});

engine.on("buildFinished", ({ output }}) => {
  console.log(`${output.fileCount} files were built.`);
});
```


### `CodeEngine.dispose()`
Releases system resources that are held by a `CodeEngine` instance. Once `dispose()` is called, the CodeEngine instance is no longer usable.

```javascript
import CodeEngine from "@code-engine/lib";

// Create a CodeEngine instance
let engine = new CodeEngine();

try {
  // Add some plugins
  await engine.use(plugin1, plugin2, plugin3);

  // Run a build
  await engine.build();
}
finally {
  // Safely dispose the instance
  await engine.dispose();
}
```



Events
-------------------------------

### "error" event
This event is fired whenever an unhandled error occurs. If you don't handle this event, then Node.js will automatically terminate the process.

> **NOTE:** When an unhandled error occurs, the `CodeEngine` instance, or one of its plugins, or one of its worker threads may be left in an invalid or unusable state. For this reason, we recommend that you [dispose the `CodeEngine` instance](#codeenginedispose) and stop using it.

```javascript
import CodeEngine from "@code-engine/lib";
let engine = new CodeEngine();

engine.on("error", (error) => {
  console.error("An unhandled error occurred:", error);
  engine.dispose();
});
```


### "log" event
This event is fired whenever CodeEngine or a plugin calls any [`Logger` method](https://github.com/CodeEngineOrg/code-engine-types/blob/master/src/logger.d.ts). The event includes the message that was logged, the severity level, the error (if any), and any other data that was provided.

```javascript
import CodeEngine from "@code-engine/lib";
let engine = new CodeEngine();

engine.on("log", ({ level, message, error, ...data }) => {
  if (level === "error" || level === "warning") {
    console.error(message, error, data);
  }
  else {
    console.log(message, data);
  }
});
```


### "buildStarting" event
This event is fired whenever a build starts. It receives a [`BuildContext` object](https://github.com/CodeEngineOrg/code-engine-types/blob/master/src/context.d.ts), which has information about the build.

```javascript
import CodeEngine from "@code-engine/lib";
let engine = new CodeEngine();

engine.on("buildStarting", ({ fullBuild, dev, changedFiles }) => {
  if (fullBuild) {
    if (dev) {
      console.log("Starting a full build in dev mode.");
    }
    else {
      console.log("Starting a full build in production mode.");
    }
  }
  else {
    console.log(`Starting a partial build of ${changedFiles.length} files.`);
  }
});
```


### "buildFinished" event
This event is fired when a build completes. It receives a [`BuildSummary` object](https://github.com/CodeEngineOrg/code-engine-types/blob/master/src/build-summary.d.ts) with the results of the build.

```javascript
import CodeEngine from "@code-engine/lib";
let engine = new CodeEngine();

engine.on("buildFinished", ({ input, output, time }) => {
  console.log(`Built ${output.fileCount} files in ${time.elapsed} milliseconds.`);
});
```



Contributing
--------------------------
Contributions, enhancements, and bug-fixes are welcome!  [File an issue](https://github.com/CodeEngineOrg/code-engine-lib/issues) on GitHub and [submit a pull request](https://github.com/CodeEngineOrg/code-engine-lib/pulls).

#### Building
To build the project locally on your computer:

1. __Clone this repo__<br>
`git clone https://github.com/CodeEngineOrg/code-engine-lib.git`

2. __Install dependencies__<br>
`npm install`

3. __Build the code__<br>
`npm run build`

4. __Run the tests__<br>
`npm test`



License
--------------------------
@code-engine/lib is 100% free and open-source, under the [MIT license](LICENSE). Use it however you want.



Big Thanks To
--------------------------
Thanks to these awesome companies for their support of Open Source developers ❤

[![Travis CI](https://engine.codes/img/badges/travis-ci.svg)](https://travis-ci.com)
[![SauceLabs](https://engine.codes/img/badges/sauce-labs.svg)](https://saucelabs.com)
[![Coveralls](https://engine.codes/img/badges/coveralls.svg)](https://coveralls.io)
