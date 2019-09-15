import { CodeEnginePlugin, isFileListProcessor, isFileProcessor } from "../plugins";
import { InitialBuildPhase, SubsequentBuildPhase } from "./build-phase";

/**
 * Splits the plugin list into separate build phases, based on which plugins are capable of running
 * in parallal, and which ones must be run sequentially.
 */
export function createBuildPhases(plugins: CodeEnginePlugin[]): [InitialBuildPhase, SubsequentBuildPhase[]] {
  let [index, initialPhase] = createInitialBuildPhase(plugins);
  let subsequentPhases = createSubsequentBuildPhases(plugins.slice(index));
  return [initialPhase, subsequentPhases];
}


/**
 * Creates the initial build phase, which consists of all the parallel plugins, up to the first sequential plugin.
 */
function createInitialBuildPhase(plugins: CodeEnginePlugin[]): [number, InitialBuildPhase] {
  let initialPhase = new InitialBuildPhase();
  let index = 0;

  for (; index < plugins.length; index++) {
    let plugin = plugins[index];

    if (isFileProcessor(plugin)) {
      initialPhase.plugins.push(plugin);
    }

    if (isFileListProcessor(plugin)) {
      // We found the first sequential plugin, which ends the initial build phase
      break;
    }
  }

  return [index, initialPhase];
}


/**
 * Creates the subsequent build phases, each of which may consist of a single sequential plugin,
 * or multiple parallel plugins.
 */
function createSubsequentBuildPhases(plugins: CodeEnginePlugin[]): SubsequentBuildPhase[] {
  let buildPhases: SubsequentBuildPhase[] = [];
  let buildPhase: SubsequentBuildPhase | undefined;

  for (let [index, plugin] of plugins.entries()) {
    if (isFileProcessor(plugin) && index > 0) {
      // Group all parallel plugins together into one build phase
      buildPhase || (buildPhase = new SubsequentBuildPhase());
      buildPhase.plugins.push(plugin);
    }

    if (isFileListProcessor(plugin)) {
      // Add all the parallel plugins that have been grouped together so far
      if (buildPhase) {
        buildPhases.push(buildPhase);
        buildPhase = undefined;
      }

      // Add the plugin directly, since it already implements `processAllFiles()`
      buildPhases.push(plugin as unknown as SubsequentBuildPhase);
    }
  }

  // Add the final build phase, if any
  if (buildPhase) {
    buildPhases.push(buildPhase);
  }

  return buildPhases;
}
